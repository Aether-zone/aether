import { Module } from '@nestjs/common';

/**
 * Oikonomos — what is owned, owed and paid for.
 *
 * A subscription is a contract that recurs and an expense is a payment that
 * happened, so the three are separate resources rather than one carrying a
 * type field that changes what its other fields mean.
 *
 * Empty for now: this is the seam, not the implementation. Controllers,
 * services and entities go here as each screen stops being a placeholder.
 */
@Module({})
export class OikonomosModule {}
