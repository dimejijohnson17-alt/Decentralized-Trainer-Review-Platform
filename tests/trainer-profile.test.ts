import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV, buffCV, principalCV, listCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 200;
const ERR_INVALID_NAME = 201;
const ERR_INVALID_BIO = 202;
const ERR_PROFILE_NOT_FOUND = 204;
const ERR_PROFILE_ALREADY_EXISTS = 205;
const ERR_INVALID_LOCATION = 206;
const ERR_INVALID_RATE = 207;
const ERR_INVALID_CURRENCY = 213;
const ERR_INVALID_CONTACT = 214;
const ERR_INVALID_IMAGE_HASH = 219;
const ERR_MAX_PROFILES_EXCEEDED = 216;
const ERR_AUTHORITY_NOT_VERIFIED = 210;

interface TrainerProfile {
  name: string;
  bio: string;
  certifications: string[];
  experienceYears: number;
  specialty: string;
  location: string;
  hourlyRate: number;
  currency: string;
  contact: string;
  imageHash: Uint8Array;
  verified: boolean;
  status: boolean;
  timestamp: number;
}

interface ProfileUpdate {
  updateName: string;
  updateBio: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class TrainerProfileMock {
  state: {
    profileCounter: number;
    maxProfiles: number;
    creationFee: number;
    authorityContract: string | null;
    trainerProfiles: Map<string, TrainerProfile>;
    profileUpdates: Map<string, ProfileUpdate>;
  } = {
    profileCounter: 0,
    maxProfiles: 5000,
    creationFee: 500,
    authorityContract: null,
    trainerProfiles: new Map(),
    profileUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TRAINER";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      profileCounter: 0,
      maxProfiles: 5000,
      creationFee: 500,
      authorityContract: null,
      trainerProfiles: new Map(),
      profileUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TRAINER";
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

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createProfile(
    name: string,
    bio: string,
    certifications: string[],
    experienceYears: number,
    specialty: string,
    location: string,
    hourlyRate: number,
    currency: string,
    contact: string,
    imageHash: Uint8Array
  ): Result<boolean> {
    if (this.state.profileCounter >= this.state.maxProfiles) return { ok: false, e: ERR_MAX_PROFILES_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_NAME };
    if (bio.length > 500) return { ok: false, value: ERR_INVALID_BIO };
    if (certifications.length > 20) return { ok: false, value: 203 };
    if (experienceYears > 50) return { ok: false, value: 211 };
    if (!specialty || specialty.length > 100) return { ok: false, value: 212 };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (hourlyRate > 1000000) return { ok: false, value: ERR_INVALID_RATE };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (contact.length > 200) return { ok: false, value: ERR_INVALID_CONTACT };
    if (imageHash.length !== 32) return { ok: false, value: ERR_INVALID_IMAGE_HASH };
    if (this.state.trainerProfiles.has(this.caller)) return { ok: false, value: ERR_PROFILE_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const profile: TrainerProfile = {
      name,
      bio,
      certifications,
      experienceYears,
      specialty,
      location,
      hourlyRate,
      currency,
      contact,
      imageHash,
      verified: false,
      status: true,
      timestamp: this.blockHeight,
    };
    this.state.trainerProfiles.set(this.caller, profile);
    this.state.profileCounter++;
    return { ok: true, value: true };
  }

  getProfile(trainer: string): TrainerProfile | null {
    return this.state.trainerProfiles.get(trainer) || null;
  }

  updateProfile(
    name: string,
    bio: string,
    specialty: string,
    location: string,
    hourlyRate: number,
    contact: string
  ): Result<boolean> {
    const profile = this.state.trainerProfiles.get(this.caller);
    if (!profile) return { ok: false, value: false };
    if (!name || name.length > 100) return { ok: false, value: false };
    if (bio.length > 500) return { ok: false, value: false };
    if (!specialty || specialty.length > 100) return { ok: false, value: false };
    if (!location || location.length > 100) return { ok: false, value: false };
    if (hourlyRate > 1000000) return { ok: false, value: false };
    if (contact.length > 200) return { ok: false, value: false };

    const updated: TrainerProfile = {
      ...profile,
      name,
      bio,
      specialty,
      location,
      hourlyRate,
      contact,
      timestamp: this.blockHeight,
    };
    this.state.trainerProfiles.set(this.caller, updated);
    this.state.profileUpdates.set(this.caller, {
      updateName: name,
      updateBio: bio,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  verifyProfile(trainer: string): Result<boolean> {
    const profile = this.state.trainerProfiles.get(trainer);
    if (!profile) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (profile.verified) return { ok: false, value: false };
    const updated: TrainerProfile = {
      ...profile,
      verified: true,
    };
    this.state.trainerProfiles.set(trainer, updated);
    return { ok: true, value: true };
  }

  getProfileCount(): Result<number> {
    return { ok: true, value: this.state.profileCounter };
  }

  checkProfileExistence(trainer: string): Result<boolean> {
    return { ok: true, value: this.state.trainerProfiles.has(trainer) };
  }
}

describe("TrainerProfile", () => {
  let contract: TrainerProfileMock;

  beforeEach(() => {
    contract = new TrainerProfileMock();
    contract.reset();
  });

  it("creates a profile successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(1);
    const result = contract.createProfile(
      "John Doe",
      "Certified trainer with 10 years experience",
      ["NASM", "ACE"],
      10,
      "Strength Training",
      "New York",
      100,
      "USD",
      "john@example.com",
      imageHash
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);

    const profile = contract.getProfile("ST1TRAINER");
    expect(profile?.name).toBe("John Doe");
    expect(profile?.bio).toBe("Certified trainer with 10 years experience");
    expect(profile?.certifications).toEqual(["NASM", "ACE"]);
    expect(profile?.experienceYears).toBe(10);
    expect(profile?.specialty).toBe("Strength Training");
    expect(profile?.location).toBe("New York");
    expect(profile?.hourlyRate).toBe(100);
    expect(profile?.currency).toBe("USD");
    expect(profile?.contact).toBe("john@example.com");
    expect(profile?.verified).toBe(false);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TRAINER", to: "ST2AUTH" }]);
  });

  it("rejects duplicate profile creation", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(1);
    contract.createProfile(
      "John Doe",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "john@example.com",
      imageHash
    );
    const result = contract.createProfile(
      "John Duplicate",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "dup@example.com",
      imageHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PROFILE_ALREADY_EXISTS);
  });

  it("rejects profile creation without authority", () => {
    const imageHash = new Uint8Array(32).fill(2);
    const result = contract.createProfile(
      "No Auth",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "noauth@example.com",
      imageHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid name", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(3);
    const result = contract.createProfile(
      "",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "invalid@example.com",
      imageHash
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NAME);
  });

  it("rejects invalid image hash", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.createProfile(
      "John",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "john@example.com",
      new Uint8Array(31)
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_IMAGE_HASH);
  });

  it("updates profile successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(4);
    contract.createProfile(
      "Old Name",
      "Old bio",
      [],
      5,
      "Old specialty",
      "Old location",
      80,
      "USD",
      "old@example.com",
      imageHash
    );
    const result = contract.updateProfile(
      "New Name",
      "New bio",
      "New specialty",
      "New location",
      120,
      "new@example.com"
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const profile = contract.getProfile("ST1TRAINER");
    expect(profile?.name).toBe("New Name");
    expect(profile?.bio).toBe("New bio");
    expect(profile?.specialty).toBe("New specialty");
    expect(profile?.location).toBe("New location");
    expect(profile?.hourlyRate).toBe(120);
    expect(profile?.contact).toBe("new@example.com");
  });

  it("rejects update for non-existent profile", () => {
    contract.caller = "ST2UNKNOWN";
    const result = contract.updateProfile("Name", "Bio", "Spec", "Loc", 100, "email");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("verifies profile successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(5);
    contract.createProfile(
      "To Verify",
      "Bio",
      [],
      5,
      "Yoga",
      "LA",
      80,
      "USD",
      "verify@example.com",
      imageHash
    );
    const result = contract.verifyProfile("ST1TRAINER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const profile = contract.getProfile("ST1TRAINER");
    expect(profile?.verified).toBe(true);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2AUTH");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
  });

  it("returns correct profile count", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(6);
    contract.createProfile("P1", "B", [], 1, "S", "L", 50, "USD", "p1@x.com", imageHash);
    contract.caller = "ST2TRAINER";
    contract.createProfile("P2", "B", [], 2, "S", "L", 60, "USD", "p2@x.com", imageHash);
    const result = contract.getProfileCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks profile existence correctly", () => {
    contract.setAuthorityContract("ST2AUTH");
    const imageHash = new Uint8Array(32).fill(7);
    contract.createProfile("Exists", "B", [], 1, "S", "L", 50, "USD", "e@x.com", imageHash);
    const result = contract.checkProfileExistence("ST1TRAINER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkProfileExistence("ST3NONE");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });
});