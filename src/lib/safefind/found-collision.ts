import {
  isFinderEditableStatus,
  type SafefindCaseStatus,
} from "./types";

export type FoundDeclarationCollision =
  | "none"
  | "same_finder_resume"
  | "same_finder_readonly"
  | "cross_finder_concurrent"
  | "cross_finder_refound";

const REFOUND_STATUSES: SafefindCaseStatus[] = [
  "DEPOSITED_AT_PARTNER",
  "STORED_AT_LOCATION",
  "PARTNER_INCIDENT",
  "READY_FOR_COLLECTION",
  "READY_FOR_PICKUP",
  "PICKUP_RESERVED",
];

/** Classify how a new found declaration should interact with an active case. */
export function classifyFoundDeclarationCollision(args: {
  declarantUserId: string;
  existing: {
    initialFinderUserId: string | null;
    status: string;
    currentPartnerId: string | null;
  };
}): FoundDeclarationCollision {
  const isOwn =
    args.existing.initialFinderUserId != null &&
    args.existing.initialFinderUserId === args.declarantUserId;

  if (isOwn) {
    return isFinderEditableStatus(args.existing.status)
      ? "same_finder_resume"
      : "same_finder_readonly";
  }

  const hadCustody =
    Boolean(args.existing.currentPartnerId) ||
    REFOUND_STATUSES.includes(args.existing.status as SafefindCaseStatus);

  return hadCustody ? "cross_finder_refound" : "cross_finder_concurrent";
}
