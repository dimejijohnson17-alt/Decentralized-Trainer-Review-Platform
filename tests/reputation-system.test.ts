import { describe, it, expect, beforeEach, vi } from "vitest";
import { principalCV, uintCV } from "@stacks/transactions";

const ERR_REVIEW_NOT_FOUND = 101;
const ERR_REPUTATION_NOT_INITIALIZED = 105;
const ERR_MAX_TRAINERS_EXCEEDED = 111;
const ERR_AUTHORITY_NOT_VERIFIED = 119;

interface TrainerRep {
  totalRating: number;
  reviewCount: number;
  verifiedCount: number;
  lastUpdated: number;
  reputationScore: number;
  active: boolean;
}

interface RepUpdate {
  oldScore: number;
  newScore: number;
  timestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReputationSystemMock {
  state: {
    reputationCounter: number;
    maxTrainers: number;
    decayRate: number;
    boostVerified: number;
    timeWeightBase: number;
    authorityContract: string | null;
    trainerRep: Map<string, TrainerRep>;
    repUpdates: Map<string, RepUpdate>;
  } = {
    reputationCounter: 0,
    maxTrainers: 5000,
    decayRate: 90,
    boostVerified: 120,
    timeWeightBase: 100,
    authorityContract: null,
    trainerRep: new Map(),
    repUpdates: new Map(),
  };
  blockHeight: number = 1000;
  caller: string = "ST1ADMIN";

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      reputationCounter: 0,
      maxTrainers: 5000,
      decayRate: 90,
      boostVerified: 120,
      timeWeightBase: 100,
      authorityContract: null,
      trainerRep: new Map(),
      repUpdates: new Map(),
    };
    this.blockHeight = 1000;
    this.caller = "ST1ADMIN";
  }

  setAuthorityContract(principal: string): Result<boolean> {
    if (principal === "SP000000000000000000002Q6VF78")
      return { ok: false, value: false };
    if (this.state.authorityContract !== null)
      return { ok: false, value: false };
    this.state.authorityContract = principal;
    return { ok: true, value: true };
  }

  setMaxTrainers(max: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxTrainers = max;
    return { ok: true, value: true };
  }

  setDecayRate(rate: number): Result<boolean> {
    if (!this.state.authorityContract || rate < 50 || rate > 99)
      return { ok: false, value: false };
    this.state.decayRate = rate;
    return { ok: true, value: true };
  }

  setBoostVerified(boost: number): Result<boolean> {
    if (!this.state.authorityContract || boost < 100 || boost > 200)
      return { ok: false, value: false };
    this.state.boostVerified = boost;
    return { ok: true, value: true };
  }

  setTimeWeightBase(weight: number): Result<boolean> {
    if (!this.state.authorityContract || weight < 50 || weight > 150)
      return { ok: false, value: false };
    this.state.timeWeightBase = weight;
    return { ok: true, value: true };
  }

  private calculateTimeDecay(lastUpdated: number): number {
    const blocksSince = this.blockHeight - lastUpdated;
    return blocksSince > 0
      ? Math.floor(
          (this.state.decayRate * this.state.timeWeightBase) /
            (100 + blocksSince)
        )
      : this.state.timeWeightBase;
  }

  private calculateRatingWeight(rating: number, verified: boolean): number {
    const base = rating * 20;
    return verified ? base * this.state.boostVerified : base;
  }

  updateReputationFromReview(reviewId: number): Result<number> {
    const review = this.mockReviewSubmission(reviewId);
    if (!review || !review.status)
      return { ok: false, value: ERR_REVIEW_NOT_FOUND };

    const trainer = review.trainer;
    const rating = review.rating;
    const verified = review.verificationStatus;
    const rep = this.state.trainerRep.get(trainer);

    if (rep) {
      const timeWeight = this.calculateTimeDecay(rep.lastUpdated);
      const ratingWeight = this.calculateRatingWeight(rating, verified);
      const weightedScore = rep.reputationScore * timeWeight + ratingWeight;
      const newScore = Math.floor(weightedScore / (timeWeight + 20));
      const newCount = rep.reviewCount + 1;
      const newVerified = verified ? rep.verifiedCount + 1 : rep.verifiedCount;

      this.state.trainerRep.set(trainer, {
        totalRating: rep.totalRating + rating,
        reviewCount: newCount,
        verifiedCount: newVerified,
        lastUpdated: this.blockHeight,
        reputationScore: newScore,
        active: true,
      });

      this.state.repUpdates.set(trainer, {
        oldScore: rep.reputationScore,
        newScore,
        timestamp: this.blockHeight,
        updater: this.caller,
      });

      return { ok: true, value: newScore };
    } else {
      if (this.state.reputationCounter >= this.state.maxTrainers)
        return { ok: false, value: ERR_MAX_TRAINERS_EXCEEDED };

      const initialScore = rating * (verified ? this.state.boostVerified : 100);
      this.state.trainerRep.set(trainer, {
        totalRating: rating,
        reviewCount: 1,
        verifiedCount: verified ? 1 : 0,
        lastUpdated: this.blockHeight,
        reputationScore: initialScore,
        active: true,
      });

      this.state.repUpdates.set(trainer, {
        oldScore: 0,
        newScore: initialScore,
        timestamp: this.blockHeight,
        updater: this.caller,
      });

      this.state.reputationCounter++;
      return { ok: true, value: initialScore };
    }
  }

  getTrainerScore(trainer: string): Result<number> {
    const rep = this.state.trainerRep.get(trainer);
    if (!rep) return { ok: false, value: ERR_REPUTATION_NOT_INITIALIZED };
    const timeWeight = this.calculateTimeDecay(rep.lastUpdated);
    return {
      ok: true,
      value: Math.floor((rep.reputationScore * timeWeight) / 100),
    };
  }

  getTrainerStats(trainer: string): Result<any> {
    const rep = this.state.trainerRep.get(trainer);
    if (!rep) return { ok: false, value: 103 };
    return {
      ok: true,
      value: {
        averageRating:
          rep.reviewCount > 0
            ? Math.floor(rep.totalRating / rep.reviewCount)
            : 0,
        reviewCount: rep.reviewCount,
        verifiedCount: rep.verifiedCount,
        reputationScore: rep.reputationScore,
        active: rep.active,
      },
    };
  }

  private mockReviewSubmission(id: number): any {
    const reviews: any = {
      0: {
        trainer: "ST3TRAINER1",
        rating: 5,
        verificationStatus: true,
        status: true,
      },
      1: {
        trainer: "ST3TRAINER1",
        rating: 4,
        verificationStatus: false,
        status: true,
      },
      2: {
        trainer: "ST3TRAINER2",
        rating: 3,
        verificationStatus: true,
        status: true,
      },
    };
    return reviews[id];
  }
}

describe("ReputationSystem", () => {
  let system: ReputationSystemMock;

  beforeEach(() => {
    system = new ReputationSystemMock();
    system.reset();
    system.setAuthorityContract("ST2AUTH");
  });

  it("initializes reputation on first review", () => {
    system.blockHeight = 1000;
    const result = system.updateReputationFromReview(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(5 * 120);

    const stats = system.getTrainerStats("ST3TRAINER1");
    expect(stats.ok).toBe(true);
    expect(stats.value.reviewCount).toBe(1);
    expect(stats.value.verifiedCount).toBe(1);
  });

  it("updates reputation with decay and boost", () => {
    system.blockHeight = 1000;
    system.updateReputationFromReview(0);
    system.blockHeight = 1100;

    const result = system.updateReputationFromReview(1);
    expect(result.ok).toBe(true);

    const score = system.getTrainerScore("ST3TRAINER1");
    expect(score.ok).toBe(true);
    expect(score.value).toBeLessThan(5 * 120);
  });

  it("respects max trainers limit", () => {
    system.setMaxTrainers(1);
    system.updateReputationFromReview(0);
    system.blockHeight = 1001;
    const result = system.updateReputationFromReview(2);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_TRAINERS_EXCEEDED);
  });

  it("calculates average rating correctly", () => {
    system.updateReputationFromReview(0);
    system.updateReputationFromReview(1);
    const stats = system.getTrainerStats("ST3TRAINER1");
    expect(stats.value.averageRating).toBe(4);
  });

  it("returns error for uninitialized trainer", () => {
    const score = system.getTrainerScore("ST3UNKNOWN");
    expect(score.ok).toBe(false);
    expect(score.value).toBe(ERR_REPUTATION_NOT_INITIALIZED);
  });

  it("handles time decay accurately", () => {
    system.updateReputationFromReview(0);
    system.blockHeight = 2000;
    const score = system.getTrainerScore("ST3TRAINER1");
    expect(score.value).toBeLessThan(5 * 120);
  });

  it("sets and validates config parameters", () => {
    expect(system.setDecayRate(95).ok).toBe(true);
    expect(system.setBoostVerified(150).ok).toBe(true);
    expect(system.setTimeWeightBase(120).ok).toBe(true);

    expect(system.setDecayRate(40).ok).toBe(false);
    expect(system.setBoostVerified(300).ok).toBe(false);
  });

  it("rejects config changes without authority", () => {
    system.state.authorityContract = null;
    expect(system.setDecayRate(95).ok).toBe(false);
  });
});
