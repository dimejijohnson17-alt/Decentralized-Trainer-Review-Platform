import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV, principalCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_RATING = 101;
const ERR_INVALID_COMMENT = 102;
const ERR_INVALID_BOOKING_HASH = 103;
const ERR_REVIEW_ALREADY_EXISTS = 104;
const ERR_REVIEW_NOT_FOUND = 105;
const ERR_SELF_REVIEW_NOT_ALLOWED = 109;
const ERR_MAX_REVIEWS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 112;
const ERR_AUTHORITY_NOT_VERIFIED = 107;
const ERR_INVALID_REVIEW_TYPE = 120;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;

interface Review {
  trainer: string;
  reviewer: string;
  rating: number;
  comment: string;
  bookingHash: Uint8Array;
  timestamp: number;
  reviewType: string;
  verificationStatus: boolean;
  location: string;
  currency: string;
  status: boolean;
}

interface ReviewUpdate {
  updateComment: string;
  updateRating: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReviewSubmissionMock {
  state: {
    reviewCounter: number;
    maxReviews: number;
    submissionFee: number;
    authorityContract: string | null;
    reviews: Map<number, Review>;
    reviewUpdates: Map<number, ReviewUpdate>;
    reviewsByBookingHash: Map<string, number>;
  } = {
    reviewCounter: 0,
    maxReviews: 10000,
    submissionFee: 100,
    authorityContract: null,
    reviews: new Map(),
    reviewUpdates: new Map(),
    reviewsByBookingHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      reviewCounter: 0,
      maxReviews: 10000,
      submissionFee: 100,
      authorityContract: null,
      reviews: new Map(),
      reviewUpdates: new Map(),
      reviewsByBookingHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  submitReview(
    trainer: string,
    rating: number,
    comment: string,
    bookingHash: Uint8Array,
    reviewType: string,
    location: string,
    currency: string
  ): Result<number> {
    if (this.state.reviewCounter >= this.state.maxReviews) return { ok: false, value: ERR_MAX_REVIEWS_EXCEEDED };
    if (rating < 1 || rating > 5) return { ok: false, value: ERR_INVALID_RATING };
    if (!comment || comment.length > 500) return { ok: false, value: ERR_INVALID_COMMENT };
    if (bookingHash.length !== 32) return { ok: false, value: ERR_INVALID_BOOKING_HASH };
    if (!["online", "in-person", "group"].includes(reviewType)) return { ok: false, value: ERR_INVALID_REVIEW_TYPE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (trainer === this.caller) return { ok: false, value: ERR_SELF_REVIEW_NOT_ALLOWED };
    const hashKey = Array.from(bookingHash).join(",");
    if (this.state.reviewsByBookingHash.has(hashKey)) return { ok: false, value: ERR_REVIEW_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.reviewCounter;
    const review: Review = {
      trainer,
      reviewer: this.caller,
      rating,
      comment,
      bookingHash,
      timestamp: this.blockHeight,
      reviewType,
      verificationStatus: false,
      location,
      currency,
      status: true,
    };
    this.state.reviews.set(id, review);
    this.state.reviewsByBookingHash.set(hashKey, id);
    this.state.reviewCounter++;
    return { ok: true, value: id };
  }

  getReview(id: number): Review | null {
    return this.state.reviews.get(id) || null;
  }

  updateReview(id: number, updateRating: number, updateComment: string): Result<boolean> {
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: false };
    if (review.reviewer !== this.caller) return { ok: false, value: false };
    if (updateRating < 1 || updateRating > 5) return { ok: false, value: false };
    if (!updateComment || updateComment.length > 500) return { ok: false, value: false };

    const updated: Review = {
      ...review,
      rating: updateRating,
      comment: updateComment,
      timestamp: this.blockHeight,
    };
    this.state.reviews.set(id, updated);
    this.state.reviewUpdates.set(id, {
      updateComment,
      updateRating,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  verifyReview(id: number): Result<boolean> {
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (review.verificationStatus) return { ok: false, value: false };
    const updated: Review = {
      ...review,
      verificationStatus: true,
    };
    this.state.reviews.set(id, updated);
    return { ok: true, value: true };
  }

  getReviewCount(): Result<number> {
    return { ok: true, value: this.state.reviewCounter };
  }

  checkReviewExistence(bookingHash: Uint8Array): Result<boolean> {
    const hashKey = Array.from(bookingHash).join(",");
    return { ok: true, value: this.state.reviewsByBookingHash.has(hashKey) };
  }
}

describe("ReviewSubmission", () => {
  let contract: ReviewSubmissionMock;

  beforeEach(() => {
    contract = new ReviewSubmissionMock();
    contract.reset();
  });

  it("submits a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(1);
    const result = contract.submitReview(
      "ST3TRAINER",
      5,
      "Great trainer!",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const review = contract.getReview(0);
    expect(review?.trainer).toBe("ST3TRAINER");
    expect(review?.reviewer).toBe("ST1TEST");
    expect(review?.rating).toBe(5);
    expect(review?.comment).toBe("Great trainer!");
    expect(review?.reviewType).toBe("in-person");
    expect(review?.location).toBe("GymX");
    expect(review?.currency).toBe("STX");
    expect(review?.verificationStatus).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 100, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate reviews by booking hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(1);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Great trainer!",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    const result = contract.submitReview(
      "ST4TRAINER",
      4,
      "Good session",
      bookingHash,
      "online",
      "Online",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_REVIEW_ALREADY_EXISTS);
  });

  it("rejects self-review", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(2);
    const result = contract.submitReview(
      "ST1TEST",
      5,
      "Self review",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_SELF_REVIEW_NOT_ALLOWED);
  });

  it("rejects submission without authority contract", () => {
    const bookingHash = new Uint8Array(32).fill(3);
    const result = contract.submitReview(
      "ST3TRAINER",
      5,
      "No auth",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid rating", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(4);
    const result = contract.submitReview(
      "ST3TRAINER",
      6,
      "Invalid rating",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RATING);
  });

  it("rejects invalid comment", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(5);
    const result = contract.submitReview(
      "ST3TRAINER",
      5,
      "",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_COMMENT);
  });

  it("rejects invalid review type", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(6);
    const result = contract.submitReview(
      "ST3TRAINER",
      5,
      "Invalid type",
      bookingHash,
      "invalid",
      "GymX",
      "STX"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REVIEW_TYPE);
  });

  it("updates a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(7);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Original",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    const result = contract.updateReview(0, 4, "Updated comment");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const review = contract.getReview(0);
    expect(review?.rating).toBe(4);
    expect(review?.comment).toBe("Updated comment");
    const update = contract.state.reviewUpdates.get(0);
    expect(update?.updateRating).toBe(4);
    expect(update?.updateComment).toBe("Updated comment");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent review", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateReview(99, 4, "Updated");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-reviewer", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(8);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Original",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateReview(0, 4, "Updated");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets submission fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.submissionFee).toBe(200);
    const bookingHash = new Uint8Array(32).fill(9);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Fee test",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    expect(contract.stxTransfers).toEqual([{ amount: 200, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects submission fee change without authority contract", () => {
    const result = contract.setSubmissionFee(200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct review count", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash1 = new Uint8Array(32).fill(10);
    const bookingHash2 = new Uint8Array(32).fill(11);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Review1",
      bookingHash1,
      "in-person",
      "GymX",
      "STX"
    );
    contract.submitReview(
      "ST4TRAINER",
      4,
      "Review2",
      bookingHash2,
      "online",
      "Online",
      "USD"
    );
    const result = contract.getReviewCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks review existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(12);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Exists",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    const result = contract.checkReviewExistence(bookingHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(13);
    const result2 = contract.checkReviewExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("verifies a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const bookingHash = new Uint8Array(32).fill(14);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "To verify",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    const result = contract.verifyReview(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const review = contract.getReview(0);
    expect(review?.verificationStatus).toBe(true);
  });

  it("rejects verification without authority", () => {
    const bookingHash = new Uint8Array(32).fill(15);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "No auth verify",
      bookingHash,
      "in-person",
      "GymX",
      "STX"
    );
    const result = contract.verifyReview(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects review submission with max reviews exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxReviews = 1;
    const bookingHash1 = new Uint8Array(32).fill(16);
    contract.submitReview(
      "ST3TRAINER",
      5,
      "Review1",
      bookingHash1,
      "in-person",
      "GymX",
      "STX"
    );
    const bookingHash2 = new Uint8Array(32).fill(17);
    const result = contract.submitReview(
      "ST4TRAINER",
      4,
      "Review2",
      bookingHash2,
      "online",
      "Online",
      "USD"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_REVIEWS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});