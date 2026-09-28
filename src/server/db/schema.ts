import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

// Managed from the Admin CMS. Not user-facing self-service.
export const inviteCode = sqliteTable("invite_code", {
  code: text("code").primaryKey(),
  note: text("note"),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  disabledAt: integer("disabled_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => user.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

// One redemption per user (PK on user_id).
export const inviteRedemption = sqliteTable("invite_redemption", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  code: text("code")
    .notNull()
    .references(() => inviteCode.code),
  redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

// 1:1 with user.
export const streamerProfile = sqliteTable("streamer_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

// 1:1 with user.
export const tipPage = sqliteTable("tip_page", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  channelName: text("channel_name").notNull(),
  links: text("links", { mode: "json" })
    .$type<{ label: string; url: string }[]>()
    .notNull()
    .default([]),
  theme: text("theme"),
  bannerUrl: text("banner_url"),
  backgroundUrl: text("background_url"),
  bodyJson: text("body_json", { mode: "json" }),
  successMessage: text("success_message"),
  failureMessage: text("failure_message"),
});

export const payoutAccount = sqliteTable("payout_account", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id),
  provider: text("provider", { enum: ["mock", "stripe"] }).notNull(),
  externalAccountId: text("external_account_id"),
  status: text("status", { enum: ["pending", "active"] })
    .notNull()
    .default("pending"),
});

export const donation = sqliteTable(
  "donation",
  {
    id: text("id").primaryKey(),
    streamerId: text("streamer_id")
      .notNull()
      .references(() => user.id),
    kind: text("kind", { enum: ["tip", "gift"] }).notNull(),
    // No `gift_type` table in phase 1 (phase 3); kept as a plain nullable
    // text column without a foreign key per the task brief.
    giftTypeId: text("gift_type_id"),
    donorName: text("donor_name").notNull(),
    messageRaw: text("message_raw"),
    amountSatang: integer("amount_satang").notNull(),
    status: text("status", { enum: ["pending", "paid", "failed"] })
      .notNull()
      .default("pending"),
    provider: text("provider").notNull(),
    // Nullable until a checkout session exists, but unique once set.
    providerSessionId: text("provider_session_id").unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("donation_streamer_status_paidAt_idx").on(
      table.streamerId,
      table.status,
      table.paidAt,
    ),
  ],
);

export const webhookEvent = sqliteTable("webhook_event", {
  providerEventId: text("provider_event_id").primaryKey(),
  receivedAt: integer("received_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

// One row per (streamer, type).
export const overlay = sqliteTable(
  "overlay",
  {
    id: text("id").primaryKey(),
    streamerId: text("streamer_id")
      .notNull()
      .references(() => user.id),
    type: text("type", {
      enum: ["alert", "gift", "top", "recent", "goal"],
    }).notNull(),
    token: text("token").notNull().unique(),
    settings: text("settings", { mode: "json" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
  },
  (table) => [
    uniqueIndex("overlay_streamer_type_idx").on(table.streamerId, table.type),
  ],
);

export const alertVariant = sqliteTable("alert_variant", {
  id: text("id").primaryKey(),
  streamerId: text("streamer_id")
    .notNull()
    .references(() => user.id),
  name: text("name").notNull(),
  minAmountSatang: integer("min_amount_satang").notNull(),
  weight: integer("weight").notNull().default(1),
  messageTemplate: text("message_template").notNull(),
  textColor: text("text_color"),
  fontFamily: text("font_family"),
  fontSize: integer("font_size"),
  imageUrl: text("image_url"),
  soundUrl: text("sound_url"),
  animationIn: text("animation_in"),
  animationOut: text("animation_out"),
  durationMs: integer("duration_ms"),
  ttsEnabled: integer("tts_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  ttsVoice: text("tts_voice"),
  sortOrder: integer("sort_order").notNull().default(0),
});
