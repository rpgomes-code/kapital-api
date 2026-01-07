// src/realtime/realtime.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards, OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { RealtimeService } from './realtime.service';
import {
  SubscribeQuotesDto,
  UnsubscribeQuotesDto,
} from './dto/subscribe-quotes.dto';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: process.env.TRUSTED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8081',
    ],
    credentials: true,
  },
})
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 10000; // 10 seconds

  // Track connected sockets by userId
  private userSockets = new Map<string, Set<string>>();

  @WebSocketServer()
  server: Server;

  constructor(
    private realtimeService: RealtimeService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  onModuleDestroy() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      // Validate session token
      const session = await this.prisma.session.findUnique({
        where: { token },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (!session || new Date(session.expiresAt) < new Date()) {
        this.logger.warn(
          `Client ${client.id} connection rejected: invalid/expired token`,
        );
        client.emit('error', { message: 'Invalid or expired session' });
        client.disconnect();
        return;
      }

      // Attach user to socket data
      client.data.user = session.user;
      client.data.userId = session.userId;

      // Track socket
      if (!this.userSockets.has(session.userId)) {
        this.userSockets.set(session.userId, new Set());
      }
      this.userSockets.get(session.userId)!.add(client.id);

      this.logger.log(
        `Client connected: ${client.id} (user: ${session.user.email})`,
      );

      // Send connection acknowledgement
      client.emit('connected', {
        message: 'Successfully connected to realtime service',
        userId: session.userId,
      });
    } catch (error) {
      this.logger.error(`Connection error for ${client.id}:`, error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;

    if (userId) {
      // Remove socket from user's socket set
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          // Unsubscribe user from all feeds
          this.realtimeService.unsubscribeAll(userId);
        }
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
    this.checkAndStopPolling();
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('subscribe:quotes')
  handleSubscribeQuotes(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SubscribeQuotesDto,
  ) {
    const userId = client.data.userId;

    // Join room for each symbol
    for (const symbol of data.symbols) {
      client.join(`quote:${symbol.toUpperCase()}`);
    }

    this.realtimeService.subscribeToQuotes(userId, data.symbols);
    this.startPolling();

    client.emit('subscribed', {
      type: 'quotes',
      symbols: data.symbols,
    });

    return { success: true, symbols: data.symbols };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('unsubscribe:quotes')
  handleUnsubscribeQuotes(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: UnsubscribeQuotesDto,
  ) {
    const userId = client.data.userId;

    // Leave rooms
    for (const symbol of data.symbols) {
      client.leave(`quote:${symbol.toUpperCase()}`);
    }

    this.realtimeService.unsubscribeFromQuotes(userId, data.symbols);
    this.checkAndStopPolling();

    return { success: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('subscribe:portfolio')
  handleSubscribePortfolio(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    client.join(`portfolio:${userId}`);
    this.realtimeService.subscribeToPortfolio(userId);
    this.startPolling();

    client.emit('subscribed', { type: 'portfolio' });

    return { success: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('unsubscribe:portfolio')
  handleUnsubscribePortfolio(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;

    client.leave(`portfolio:${userId}`);
    this.realtimeService.unsubscribeFromPortfolio(userId);
    this.checkAndStopPolling();

    return { success: true };
  }

  // Handle alert triggered events from the job
  @OnEvent('alert.triggered')
  handleAlertTriggered(payload: {
    userId: string;
    alert: unknown;
    currentPrice: number;
  }) {
    this.server.to(`portfolio:${payload.userId}`).emit('alert:triggered', {
      alert: payload.alert,
      currentPrice: payload.currentPrice,
      timestamp: new Date(),
    });

    this.logger.log(`Alert notification sent to user ${payload.userId}`);
  }

  private startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      await this.broadcastUpdates();
    }, this.POLL_INTERVAL);

    this.logger.log('Started quote polling');
  }

  private checkAndStopPolling() {
    const hasSubscribers = this.realtimeService.hasActiveSubscriptions();

    if (!hasSubscribers && this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log('Stopped quote polling - no subscribers');
    }
  }

  private async broadcastUpdates() {
    try {
      // Broadcast quote updates
      const quoteUpdates = await this.realtimeService.fetchQuoteUpdates();

      for (const [symbol, update] of quoteUpdates) {
        this.server.to(`quote:${symbol}`).emit('quote:update', update);
      }

      // Broadcast portfolio updates
      for (const userId of this.realtimeService.getPortfolioSubscribers()) {
        const portfolioUpdate =
          await this.realtimeService.fetchPortfolioUpdate(userId);
        if (portfolioUpdate) {
          this.server
            .to(`portfolio:${userId}`)
            .emit('portfolio:update', portfolioUpdate);
        }
      }
    } catch (error) {
      this.logger.error('Error broadcasting updates:', error);
    }
  }
}
