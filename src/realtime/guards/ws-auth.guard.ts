// src/realtime/guards/ws-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { PrismaService } from '../../prisma/prisma.service';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();

    try {
      // Extract token from handshake auth or query
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '') ||
        (client.handshake.query?.token as string);

      if (!token) {
        throw new WsException('No authentication token provided');
      }

      // Validate session token against database
      const session = await this.prisma.session.findUnique({
        where: { token },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (!session) {
        throw new WsException('Invalid session token');
      }

      if (new Date(session.expiresAt) < new Date()) {
        throw new WsException('Session expired');
      }

      // Attach user to socket data for later use
      client.data.user = session.user;
      client.data.userId = session.userId;

      return true;
    } catch (error) {
      this.logger.warn(`WebSocket auth failed: ${(error as Error).message}`);
      throw new WsException('Authentication failed');
    }
  }
}
