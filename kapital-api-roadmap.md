# Kapital API - Comprehensive Development Roadmap

> **Project Goal**: A portfolio and investment tracking API (alternative to Snowball Analytics & Qualtrim) for personal use with family and friends (~10 users)
>
> **Tech Stack**: NestJS + TypeScript + Prisma + PostgreSQL + Yahoo Finance 2 + Better Auth
>
> **Frontends**: NextJS Web App + Expo React Native Mobile App

---

## 📊 Current State Analysis

### ✅ What's Already Implemented

| Module | Status | Notes |
|--------|--------|-------|
| **PrismaModule** | ✅ Complete | Database connection configured (Prisma v7 with pg adapter) |
| **AuthModule** | ✅ Complete | Better Auth integration with email/password |
| **UsersModule** | ✅ Complete | CRUD operations, UUID-based IDs |
| **BrokersModule** | ✅ Complete | Broker management, user linking, @AllowAnonymous for public routes |
| **AccountsModule** | ✅ Complete | Account CRUD per user-broker |
| **AssetsModule** | ✅ Complete | Asset management, find-or-create from Yahoo |
| **TransactionsModule** | ✅ Complete | Transaction CRUD, pagination |
| **WatchlistsModule** | ✅ Complete | Watchlist management with live prices |
| **PortfolioModule** | ✅ Complete | Summary, performance, allocation |
| **YahooFinanceModule** | ✅ Complete | search, quote, quotes, historical, quoteSummary, chart, recommendations, insights, trending, gainers/losers, screener |

### Database Schema Status

| Model | Status | Notes |
|-------|--------|-------|
| User | ✅ | UUID-based ID, Better Auth compatible |
| Session | ✅ | Better Auth session management |
| AuthAccount | ✅ | OAuth provider accounts (email/password working) |
| Verification | ✅ | Email verification tokens |
| Role/Permission | ✅ | RBAC ready but not integrated |
| Broker/UserBroker | ✅ | Working |
| Account | ✅ | Working |
| Asset | ✅ | Has sector/industry relations |
| Transaction | ✅ | FIFO lot tracking implemented |
| AssetPrice | ✅ | Schema ready, not populated |
| CorporateAction | ✅ | Schema ready, not implemented |
| Watchlist/WatchlistAsset | ✅ | Working |
| Benchmark | ✅ | Schema ready, not implemented |
| Tag/TransactionTag | ✅ | Schema ready, not implemented |

### Yahoo Finance 2 - Current vs Available

| Module | Available | Implemented | Priority |
|--------|-----------|-------------|----------|
| `search` | ✅ | ✅ | - |
| `quote` | ✅ | ✅ | - |
| `historical` | ✅ | ✅ | - |
| `quoteSummary` | ✅ | ✅ | - |
| `chart` | ✅ | ✅ | - |
| `fundamentalsTimeSeries` | ✅ | ❌ | High |
| `insights` | ✅ | ✅ | - |
| `options` | ✅ | ❌ | Medium |
| `recommendationsBySymbol` | ✅ | ✅ | - |
| `screener` | ✅ | ✅ | - |
| `trendingSymbols` | ✅ | ✅ | - |
| `dailyGainers` | ✅ | ✅ | - |
| `dailyLosers` | ✅ | ✅ | - |

---

## 🗺️ Development Roadmap

### Phase 1: Foundation & Critical Fixes ✅ COMPLETE
**Estimated Duration**: 1-2 weeks
**Priority**: 🔴 Critical
**Status**: ✅ Completed (January 2026)

#### 1.1 Better Auth Integration ✅
```
✅ Install and configure Better Auth (@thallesp/nestjs-better-auth)
✅ Add auth fields to User model (UUID-based ID, sessions, accounts)
✅ Create AuthModule with guards (via nestjs-better-auth)
✅ Implement session-based token validation
✅ Add session management (7-day sessions, 24h refresh)
✅ Create login/register/logout endpoints (/api/auth/*)
□ Add refresh token support (handled by Better Auth internally)
□ Implement password reset flow
□ Add social login support (Google, GitHub) - optional
```

**Schema Implemented**:
```prisma
model User {
  id            String    @id @default(uuid())  // Changed from Int to UUID
  username      String?
  email         String    @unique
  name          String?
  image         String?
  country       String?
  mainCurrency  String    @default("USD")
  emailVerified Boolean   @default(false)
  sessions      Session[]
  accounts      AuthAccount[]
  // ... other relations
}

model Session {
  id        String   @id @default(uuid())
  expiresAt DateTime
  token     String   @unique
  userId    String   // UUID reference
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("sessions")
}

model AuthAccount {
  id                    String    @id @default(uuid())
  accountId             String
  providerId            String    // "credential" for email/password
  accessToken           String?
  refreshToken          String?
  password              String?   // Hashed password for credential provider
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("auth_accounts")
}

model Verification {
  id         String    @id @default(uuid())
  identifier String
  value      String
  expiresAt  DateTime
  @@map("verifications")
}
```

#### 1.2 API Security & Guards ✅
```
✅ Auth guard via @thallesp/nestjs-better-auth (session-based)
□ Create RolesGuard (for future admin features)
✅ Add @AllowAnonymous() decorator for open endpoints
✅ Protect all existing endpoints with auth (default behavior)
✅ Add rate limiting (ThrottlerGuard - 100 req/min)
□ Implement request logging
✅ Add CORS configuration for frontends (trustedOrigins in Better Auth)
```

#### 1.3 Code Quality & Fixes
```
✅ Fix getAllocationBySector (now returns sector allocation with values and percentages)
✅ Add proper error handling for Yahoo Finance API failures
✅ Implement retry logic for external API calls (exponential backoff with jitter)
□ Add request/response logging interceptor
□ Complete unit tests for all services
□ Add integration tests for critical flows
□ Configure ESLint strict rules
□ Add Husky pre-commit hooks
```

#### 1.4 API Documentation Enhancement 🟡 Partial
```
✅ Add authentication to Swagger docs (@ApiBearerAuth)
✅ Document all DTOs with examples (@ApiProperty)
✅ Add response type decorators (@ApiResponse)
✅ Group endpoints by feature area (@ApiTags)
✅ Add API versioning (/api/v1 prefix)
□ Add API versioning headers
```

---

### Phase 2: Complete Yahoo Finance Integration
**Estimated Duration**: 2-3 weeks
**Priority**: 🔴 High

#### 2.1 Chart Module
Real-time and historical charting data with various intervals.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/chart/:symbol
  Query: interval (1m|5m|15m|30m|1h|1d|1wk|1mo)
  Query: range (1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|ytd|max)
  Query: includePrePost (boolean)

GET /api/v1/yahoo-finance/chart/:symbol/compare
  Query: symbols (comma-separated for comparison)
  Query: range
```

**Features**:
```
□ Intraday data (1m, 5m, 15m, 30m, 1h intervals)
□ Daily/Weekly/Monthly historical data
□ Pre/Post market data inclusion
□ Multiple symbol comparison
□ Technical indicator calculations (SMA, EMA, RSI, MACD)
□ Volume data
□ Splits and dividends overlay
```

#### 2.2 Full QuoteSummary Implementation
Expose ALL 32 quoteSummary submodules.

```typescript
// Enhanced Endpoint
GET /api/v1/yahoo-finance/summary/:symbol
  Query: modules (comma-separated, default: all commonly used)

// Convenience Endpoints
GET /api/v1/yahoo-finance/summary/:symbol/profile      // assetProfile + summaryProfile
GET /api/v1/yahoo-finance/summary/:symbol/financials   // financialData + defaultKeyStatistics
GET /api/v1/yahoo-finance/summary/:symbol/earnings     // earnings + earningsHistory + earningsTrend
GET /api/v1/yahoo-finance/summary/:symbol/holders      // institutionOwnership + fundOwnership + insiderHolders + majorHoldersBreakdown
GET /api/v1/yahoo-finance/summary/:symbol/analysis     // recommendationTrend + upgradeDowngradeHistory
GET /api/v1/yahoo-finance/summary/:symbol/calendar     // calendarEvents
GET /api/v1/yahoo-finance/summary/:symbol/sec-filings  // secFilings
```

**All QuoteSummary Modules to Implement**:
```
□ assetProfile - Company info, officers, governance
□ balanceSheetHistory - Annual balance sheets
□ balanceSheetHistoryQuarterly - Quarterly balance sheets
□ calendarEvents - Earnings dates, dividends, splits
□ cashflowStatementHistory - Annual cash flow
□ cashflowStatementHistoryQuarterly - Quarterly cash flow
□ defaultKeyStatistics - Key metrics (P/E, EPS, etc.)
□ earnings - Quarterly earnings data
□ earningsHistory - Historical earnings surprises
□ earningsTrend - Analyst earnings estimates
□ financialData - Financial health metrics
□ fundOwnership - Fund holdings
□ fundPerformance - Fund returns (for ETFs/funds)
□ fundProfile - Fund details (for ETFs/funds)
□ incomeStatementHistory - Annual income statements
□ incomeStatementHistoryQuarterly - Quarterly income statements
□ indexTrend - Index estimates
□ industryTrend - Industry trends
□ insiderHolders - Insider ownership
□ insiderTransactions - Insider buying/selling
□ institutionOwnership - Institutional holdings
□ majorDirectHolders - Major shareholders
□ majorHoldersBreakdown - Ownership percentages
□ netSharePurchaseActivity - Net insider activity
□ price - Price details
□ quoteType - Security type info
□ recommendationTrend - Analyst recommendations
□ secFilings - SEC filings list
□ sectorTrend - Sector analysis
□ summaryDetail - Trading details
□ summaryProfile - Company description
□ topHoldings - ETF/Fund holdings
□ upgradeDowngradeHistory - Analyst rating changes
```

#### 2.3 Fundamentals Time Series
Historical fundamental data for financial analysis.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/fundamentals/:symbol
  Query: type (annual|quarterly|trailing)
  Query: period1 (start date)
  Query: period2 (end date)
  Query: metrics (comma-separated specific metrics)

GET /api/v1/yahoo-finance/fundamentals/:symbol/income
GET /api/v1/yahoo-finance/fundamentals/:symbol/balance-sheet
GET /api/v1/yahoo-finance/fundamentals/:symbol/cash-flow
GET /api/v1/yahoo-finance/fundamentals/:symbol/ratios
```

**Features**:
```
□ Income statement time series
□ Balance sheet time series
□ Cash flow statement time series
□ Key ratios over time (P/E, P/B, ROE, etc.)
□ Custom metric selection
□ Period comparison
□ YoY/QoQ growth calculations
```

#### 2.4 Insights Module
AI-powered research and analysis insights.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/insights/:symbol

// Response includes:
// - Technical events
// - Valuation metrics
// - Company outlook
// - Sector outlook
// - Analyst recommendations
// - Significant developments
```

**Features**:
```
□ Technical events (support/resistance, momentum)
□ Valuation assessment
□ Short/mid/long term outlook
□ Sector comparison
□ Key developments
□ Bullish/bearish signals
```

#### 2.5 Recommendations Module
Find related and recommended securities.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/recommendations/:symbol
GET /api/v1/yahoo-finance/recommendations/portfolio
  Query: userId (get recommendations based on user's portfolio)
```

**Features**:
```
□ Single symbol recommendations
□ Batch recommendations for multiple symbols
□ Portfolio-based recommendations
□ Similarity scores
□ Filter by asset type
```

#### 2.6 Screener Module
Powerful stock screening with multiple criteria.

```typescript
// New Endpoints
POST /api/v1/yahoo-finance/screener
  Body: { filters, sortBy, sortOrder, limit, offset }

GET /api/v1/yahoo-finance/screener/presets
GET /api/v1/yahoo-finance/screener/presets/:presetId

// Preset Screeners
GET /api/v1/yahoo-finance/screener/growth-stocks
GET /api/v1/yahoo-finance/screener/value-stocks
GET /api/v1/yahoo-finance/screener/dividend-stocks
GET /api/v1/yahoo-finance/screener/small-cap
GET /api/v1/yahoo-finance/screener/large-cap
```

**Filter Categories**:
```
□ Price filters (price, change, 52w high/low)
□ Valuation filters (P/E, P/B, P/S, EV/EBITDA)
□ Dividend filters (yield, payout ratio)
□ Growth filters (revenue growth, earnings growth)
□ Profitability filters (margins, ROE, ROA)
□ Debt filters (debt/equity, current ratio)
□ Size filters (market cap, enterprise value)
□ Volume filters (avg volume, relative volume)
□ Sector/Industry filters
□ Region/Exchange filters
```

#### 2.7 Market Overview Endpoints
Trending and market movement data.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/market/trending
  Query: region (US|GB|DE|FR|JP|etc.)
  Query: count

GET /api/v1/yahoo-finance/market/gainers
  Query: region
  Query: count

GET /api/v1/yahoo-finance/market/losers
  Query: region
  Query: count

GET /api/v1/yahoo-finance/market/most-active
  Query: region
  Query: count

GET /api/v1/yahoo-finance/market/indices
  // Returns major indices (S&P 500, DOW, NASDAQ, etc.)

GET /api/v1/yahoo-finance/market/sectors
  // Returns sector performance
```

**Features**:
```
□ Trending symbols by region
□ Daily gainers with % change
□ Daily losers with % change
□ Most actively traded
□ Major indices quotes
□ Sector performance heatmap data
```

#### 2.8 Options Chain Module
Options data for advanced trading analysis.

```typescript
// New Endpoints
GET /api/v1/yahoo-finance/options/:symbol
  Query: date (expiration date)

GET /api/v1/yahoo-finance/options/:symbol/expirations
GET /api/v1/yahoo-finance/options/:symbol/chain
  Query: date
  Query: type (calls|puts|all)
  Query: strikeMin
  Query: strikeMax
```

**Features**:
```
□ Available expiration dates
□ Full options chain
□ Calls and puts separately
□ Strike price filtering
□ Greeks (delta, gamma, theta, vega)
□ Open interest and volume
□ Implied volatility
```

---

### Phase 3: Advanced Portfolio Analytics
**Estimated Duration**: 2-3 weeks
**Priority**: 🟠 High

#### 3.1 Enhanced Portfolio Calculations

```typescript
// New/Enhanced Endpoints
GET /api/v1/portfolio/summary
GET /api/v1/portfolio/holdings
GET /api/v1/portfolio/performance
  Query: period (1d|1w|1m|3m|6m|1y|ytd|all)
  Query: benchmark (SPY|QQQ|custom)

GET /api/v1/portfolio/history
  Query: startDate
  Query: endDate
  Query: interval (daily|weekly|monthly)

GET /api/v1/portfolio/dividends
  Query: year
  Query: includeProjected

GET /api/v1/portfolio/tax-lots/:assetId
```

**New Calculations**:
```
□ Time-weighted return (TWR)
□ Money-weighted return (MWR/IRR)
□ Sharpe ratio
□ Sortino ratio
□ Beta vs benchmark
□ Alpha calculation
□ Maximum drawdown
□ Volatility (standard deviation)
□ Value at Risk (VaR)
□ Treynor ratio
□ Information ratio
□ Dividend yield on cost
□ Portfolio correlation matrix
```

#### 3.2 Historical Portfolio Value Tracking

**Schema Addition**:
```prisma
model PortfolioSnapshot {
  id           Int      @id @default(autoincrement())
  userId       Int      @map("user_id")
  date         DateTime @db.Date
  totalValue   Decimal  @map("total_value") @db.Decimal(18, 2)
  totalCost    Decimal  @map("total_cost") @db.Decimal(18, 2)
  dayChange    Decimal  @map("day_change") @db.Decimal(18, 2)
  cashBalance  Decimal  @map("cash_balance") @db.Decimal(18, 2)
  createdAt    DateTime @default(now()) @map("created_at")
  user         User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, date])
  @@map("portfolio_snapshots")
}

model HoldingSnapshot {
  id            Int      @id @default(autoincrement())
  snapshotId    Int      @map("snapshot_id")
  assetId       Int      @map("asset_id")
  quantity      Decimal  @db.Decimal(18, 8)
  price         Decimal  @db.Decimal(18, 4)
  value         Decimal  @db.Decimal(18, 2)
  costBasis     Decimal  @map("cost_basis") @db.Decimal(18, 2)
  
  @@map("holding_snapshots")
}
```

**Features**:
```
□ Daily portfolio snapshots (scheduled job)
□ Historical value chart data
□ Performance comparison over periods
□ Holdings breakdown over time
□ Asset allocation changes over time
```

#### 3.3 Benchmark Comparison

```typescript
// New Endpoints
GET /api/v1/benchmarks
POST /api/v1/benchmarks
GET /api/v1/benchmarks/:id

GET /api/v1/portfolio/vs-benchmark
  Query: benchmarkId
  Query: period
```

**Features**:
```
□ Predefined benchmarks (S&P 500, NASDAQ, etc.)
□ Custom benchmark creation
□ Portfolio vs benchmark chart
□ Relative performance metrics
□ Tracking error calculation
```

#### 3.4 Dividend Analysis

```typescript
// New Endpoints
GET /api/v1/portfolio/dividends/summary
GET /api/v1/portfolio/dividends/history
GET /api/v1/portfolio/dividends/calendar
GET /api/v1/portfolio/dividends/projection
```

**Features**:
```
□ Total dividends received
□ Dividends by holding
□ Monthly/yearly breakdown
□ Dividend calendar (upcoming)
□ Projected annual income
□ Dividend growth tracking
□ DRIP simulation
□ Yield on cost tracking
```

#### 3.5 Tax Lot Management

```typescript
// New Endpoints
GET /api/v1/portfolio/tax-lots
GET /api/v1/portfolio/tax-lots/:assetId
GET /api/v1/portfolio/realized-gains
  Query: year
  Query: type (short-term|long-term|all)

POST /api/v1/portfolio/tax-loss-harvest
  // Suggest tax loss harvesting opportunities
```

**Features**:
```
□ Detailed lot tracking
□ FIFO/LIFO/Specific lot selection
□ Short-term vs long-term classification
□ Wash sale detection
□ Tax loss harvesting suggestions
□ Realized gains report
□ Cost basis methods comparison
```

#### 3.6 Currency Support

```typescript
// New Endpoints
GET /api/v1/currencies/rates
GET /api/v1/currencies/convert
  Query: from, to, amount

GET /api/v1/portfolio/summary
  Query: currency (convert all to specified currency)
```

**Features**:
```
□ Multi-currency holdings
□ Real-time exchange rates
□ Portfolio value in user's preferred currency
□ FX gain/loss tracking
□ Currency allocation view
```

---

### Phase 4: Data Management & Caching
**Estimated Duration**: 1-2 weeks
**Priority**: 🟠 High

#### 4.1 Historical Price Caching

**Schema Addition**:
```prisma
model PriceCache {
  id        Int      @id @default(autoincrement())
  symbol    String
  date      DateTime @db.Date
  open      Decimal  @db.Decimal(18, 4)
  high      Decimal  @db.Decimal(18, 4)
  low       Decimal  @db.Decimal(18, 4)
  close     Decimal  @db.Decimal(18, 4)
  adjClose  Decimal  @map("adj_close") @db.Decimal(18, 4)
  volume    BigInt
  createdAt DateTime @default(now()) @map("created_at")
  
  @@unique([symbol, date])
  @@index([symbol])
  @@map("price_cache")
}
```

**Features**:
```
□ Cache historical prices on first request
□ Incremental updates for new dates
□ Fallback to Yahoo on cache miss
□ Cache invalidation strategy
□ Storage optimization (older data compression)
```

#### 4.2 Asset Data Enrichment

```typescript
// Background job to enrich assets
□ Auto-fetch sector/industry from Yahoo
□ Update asset names and metadata
□ Sync exchange information
□ Handle symbol changes
□ Track delisted securities
```

#### 4.3 Corporate Actions Processing

```typescript
// New Endpoints
GET /api/v1/assets/:id/corporate-actions
GET /api/v1/corporate-actions/upcoming

// Types to handle:
□ Stock splits (adjust historical quantities)
□ Reverse splits
□ Dividends (auto-create transactions)
□ Spin-offs
□ Mergers/Acquisitions
□ Symbol changes
```

#### 4.4 Scheduled Jobs System

```typescript
// Using @nestjs/schedule
□ Daily portfolio snapshot (end of day)
□ Price cache update (after market close)
□ Dividend detection and recording
□ Corporate action processing
□ Asset data refresh
□ Alert checking
```

---

### Phase 5: Real-time Features
**Estimated Duration**: 1-2 weeks
**Priority**: 🟡 Medium

#### 5.1 WebSocket Gateway

```typescript
// WebSocket Events
@WebSocketGateway()
export class MarketGateway {
  // Client subscribes to symbols
  @SubscribeMessage('subscribe')
  handleSubscribe(symbols: string[])
  
  // Server pushes updates
  emitQuoteUpdate(symbol: string, quote: Quote)
  emitPortfolioUpdate(userId: number, summary: PortfolioSummary)
  emitAlert(userId: number, alert: Alert)
}
```

**Features**:
```
□ Real-time quote streaming
□ Portfolio value updates
□ Price alert notifications
□ Connection management
□ Subscription management
□ Heartbeat/reconnection handling
```

#### 5.2 Price Alerts System

**Schema Addition**:
```prisma
model PriceAlert {
  id          Int         @id @default(autoincrement())
  userId      Int         @map("user_id")
  assetId     Int         @map("asset_id")
  type        AlertType   // ABOVE, BELOW, PERCENT_CHANGE
  targetValue Decimal     @map("target_value") @db.Decimal(18, 4)
  isActive    Boolean     @default(true) @map("is_active")
  triggeredAt DateTime?   @map("triggered_at")
  createdAt   DateTime    @default(now()) @map("created_at")
  user        User        @relation(fields: [userId], references: [id])
  asset       Asset       @relation(fields: [assetId], references: [id])
  
  @@map("price_alerts")
}

enum AlertType {
  PRICE_ABOVE
  PRICE_BELOW
  PERCENT_UP
  PERCENT_DOWN
  VOLUME_SPIKE
}
```

```typescript
// New Endpoints
POST /api/v1/alerts
GET /api/v1/alerts
GET /api/v1/alerts/:id
DELETE /api/v1/alerts/:id
PATCH /api/v1/alerts/:id/toggle
```

---

### Phase 6: Import/Export & Reports
**Estimated Duration**: 1-2 weeks
**Priority**: 🟡 Medium

#### 6.1 Transaction Import

```typescript
// New Endpoints
POST /api/v1/import/transactions
  // Accepts CSV file

POST /api/v1/import/transactions/preview
  // Preview parsed data before committing

GET /api/v1/import/templates/:broker
  // Get CSV template for specific broker format
```

**Supported Formats**:
```
□ Generic CSV format
□ Interactive Brokers format
□ Trading 212 format
□ Degiro format
□ XTB format
□ Custom mapping configuration
```

#### 6.2 Data Export

```typescript
// New Endpoints
GET /api/v1/export/transactions
  Query: format (csv|xlsx|json)
  Query: startDate, endDate

GET /api/v1/export/portfolio
  Query: format

GET /api/v1/export/tax-report
  Query: year
  Query: format
```

#### 6.3 Report Generation

```typescript
// New Endpoints
GET /api/v1/reports/portfolio-summary
  Query: format (pdf|html)

GET /api/v1/reports/performance
  Query: period
  Query: format

GET /api/v1/reports/tax
  Query: year
  Query: country (for format/rules)
```

**Reports to Generate**:
```
□ Portfolio summary report
□ Performance report
□ Holdings report
□ Transaction history
□ Dividend report
□ Tax report (realized gains)
□ Year-end summary
```

---

### Phase 7: User Experience Features
**Estimated Duration**: 1 week
**Priority**: 🟢 Low

#### 7.1 Transaction Tags & Notes

```typescript
// Update existing endpoints
□ Add tags support to transactions
□ Add notes field to transactions
□ Tag management endpoints (CRUD)
□ Filter transactions by tag
□ Tag-based analytics
```

#### 7.2 Custom Groups/Categories

```typescript
// New feature: Group holdings
POST /api/v1/groups
GET /api/v1/groups
GET /api/v1/portfolio/by-group
```

#### 7.3 User Preferences

```prisma
model UserPreferences {
  id                Int     @id @default(autoincrement())
  userId            Int     @unique @map("user_id")
  defaultCurrency   String  @default("USD") @map("default_currency")
  dateFormat        String  @default("YYYY-MM-DD") @map("date_format")
  numberFormat      String  @default("en-US") @map("number_format")
  theme             String  @default("system")
  defaultBenchmark  String? @map("default_benchmark")
  costBasisMethod   String  @default("FIFO") @map("cost_basis_method")
  
  @@map("user_preferences")
}
```

#### 7.4 Notification System

```typescript
// Push notifications for:
□ Price alerts triggered
□ Dividend received
□ Large portfolio movements
□ Earnings announcements
□ Custom alerts
```

---

### Phase 8: Performance & Polish
**Estimated Duration**: 1 week
**Priority**: 🟢 Low

#### 8.1 Performance Optimization
```
□ Database query optimization
□ Add missing indexes
□ Implement Redis caching layer
□ API response compression
□ Lazy loading for large datasets
□ Pagination optimization
```

#### 8.2 Error Handling & Resilience
```
□ Circuit breaker for Yahoo API
□ Graceful degradation
□ Retry with exponential backoff
□ Request timeout handling
□ Error tracking (Sentry integration)
```

#### 8.3 Testing & Documentation
```
□ Increase unit test coverage to 80%+
□ Add E2E tests for critical paths
□ Performance/load testing
□ API documentation completion
□ README with setup instructions
□ Postman collection
```

---

## 📁 Suggested Project Structure

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   └── current-user.decorator.ts
│   └── dto/
│
├── common/
│   ├── dto/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   └── utils/
│
├── prisma/
│
├── users/
├── brokers/
├── accounts/
├── assets/
├── transactions/
├── watchlists/
│
├── portfolio/
│   ├── portfolio.module.ts
│   ├── portfolio.controller.ts
│   ├── portfolio.service.ts
│   ├── services/
│   │   ├── holdings.service.ts
│   │   ├── performance.service.ts
│   │   ├── dividends.service.ts
│   │   ├── tax-lots.service.ts
│   │   └── snapshots.service.ts
│   └── dto/
│
├── yahoo-finance/
│   ├── yahoo-finance.module.ts
│   ├── yahoo-finance.controller.ts
│   ├── yahoo-finance.service.ts
│   ├── services/
│   │   ├── quote.service.ts
│   │   ├── chart.service.ts
│   │   ├── fundamentals.service.ts
│   │   ├── screener.service.ts
│   │   ├── insights.service.ts
│   │   ├── options.service.ts
│   │   └── market.service.ts
│   └── dto/
│
├── market/
│   ├── market.module.ts
│   ├── market.controller.ts
│   └── market.service.ts
│
├── alerts/
│   ├── alerts.module.ts
│   ├── alerts.controller.ts
│   └── alerts.service.ts
│
├── import-export/
│   ├── import-export.module.ts
│   ├── import.controller.ts
│   ├── export.controller.ts
│   ├── import.service.ts
│   └── export.service.ts
│
├── reports/
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   └── reports.service.ts
│
├── websocket/
│   ├── websocket.module.ts
│   ├── websocket.gateway.ts
│   └── websocket.service.ts
│
├── jobs/
│   ├── jobs.module.ts
│   └── services/
│       ├── snapshot.job.ts
│       ├── price-cache.job.ts
│       ├── dividends.job.ts
│       └── alerts.job.ts
│
└── app.module.ts
```

---

## 🔧 Required Dependencies to Add

```bash
# Authentication
npm install better-auth

# Scheduling
npm install @nestjs/schedule

# WebSockets
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# Rate Limiting
npm install @nestjs/throttler

# Caching (optional, for Redis)
npm install @nestjs/cache-manager cache-manager cache-manager-redis-store

# File Processing
npm install papaparse @types/papaparse
npm install exceljs
npm install pdfmake @types/pdfmake

# Validation (already have, ensure up to date)
npm install class-validator class-transformer
```

---

## 📅 Suggested Timeline

| Phase | Duration | Milestone |
|-------|----------|-----------|
| Phase 1: Foundation | 1-2 weeks | Auth working, API secured |
| Phase 2: Yahoo Finance | 2-3 weeks | All YF modules exposed |
| Phase 3: Portfolio Analytics | 2-3 weeks | Advanced metrics working |
| Phase 4: Data Management | 1-2 weeks | Caching & jobs running |
| Phase 5: Real-time | 1-2 weeks | WebSocket working |
| Phase 6: Import/Export | 1-2 weeks | CSV import working |
| Phase 7: UX Features | 1 week | Tags, notes, prefs |
| Phase 8: Polish | 1 week | Tests, docs complete |

**Total Estimated Time**: 10-16 weeks (part-time development)

---

## 🎯 Quick Wins (Can Do Immediately)

1. ~~**Fix `getAllocationBySector`**~~ ✅ Completed - Now returns sector allocation with values and percentages
2. ~~**Add missing Yahoo Finance endpoints**~~ ✅ Completed - `trendingSymbols`, `dailyGainers`, `dailyLosers`
3. ~~**Add `chart` endpoint**~~ ✅ Completed - Full chart support with intraday intervals and ranges
4. ~~**Add `recommendations` endpoint**~~ ✅ Completed - Similar symbols discovery
5. ~~**Improve error handling**~~ ✅ Completed - Retry logic with exponential backoff
6. **Add request logging** - Debug and monitor API usage

## ✅ Recently Completed

- **Yahoo Finance Module Expansion** (January 2026)
  - Added chart endpoint with intraday intervals (1m, 5m, 15m, 30m, 1h) and ranges (1d to max)
  - Added recommendations endpoint for similar symbol discovery
  - Added insights endpoint for AI-powered analysis
  - Added market overview endpoints (trending, gainers, losers)
  - Added screener endpoint with predefined presets
  - Implemented retry logic with exponential backoff for all Yahoo Finance API calls
  - Fixed getAllocationBySector to return proper sector allocation data

- **Better Auth Integration** (January 2026)
  - Email/password authentication working
  - Session-based auth with cookie tokens
  - UUID-based User IDs for Better Auth compatibility
  - All endpoints protected by default, @AllowAnonymous for public routes
  - Rate limiting (100 req/min via ThrottlerGuard)

- **Auth Endpoints Available**:
  - `POST /api/auth/sign-up/email` - User registration
  - `POST /api/auth/sign-in/email` - User login
  - `POST /api/auth/sign-out` - User logout
  - `GET /api/auth/session` - Get current session

- **New Yahoo Finance Endpoints Available**:
  - `GET /api/v1/yahoo-finance/chart/:symbol` - Chart data with intraday intervals
  - `GET /api/v1/yahoo-finance/recommendations/:symbol` - Similar symbols
  - `GET /api/v1/yahoo-finance/insights/:symbol` - AI-powered insights
  - `GET /api/v1/yahoo-finance/market/trending` - Trending symbols by region
  - `GET /api/v1/yahoo-finance/market/gainers` - Top daily gainers
  - `GET /api/v1/yahoo-finance/market/losers` - Top daily losers
  - `GET /api/v1/yahoo-finance/screener/:preset` - Predefined stock screeners

---

## 📝 Notes

### Yahoo Finance 2 Usage Pattern
Always use instance pattern (as per your memory):
```typescript
const yf = new YahooFinance();
await yf.quote(symbol);  // ✅ Correct
// NOT: YahooFinance.quote(symbol)  // ❌ Deprecated
```

### API Rate Limits
Yahoo Finance has unofficial rate limits. Consider:
- Implementing request queuing
- Caching frequently requested data
- Using `quoteCombine` for batch requests

### Frontend Considerations
For NextJS + Expo:
- Use consistent response formats
- Include pagination metadata
- Support filtering/sorting via query params
- Return ISO date strings
- Use public IDs in URLs (not internal IDs)

---

*Last Updated: January 7, 2026*
*Version: 1.2 - Yahoo Finance Module Expansion Complete*
