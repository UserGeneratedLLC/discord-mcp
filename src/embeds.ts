import { EmbedBuilder, ColorResolvable } from "discord.js";
import { z } from "zod";

/**
 * Zod fields of a rich embed — spread into a tool's `z.object({...})` schema.
 * The zod source of truth for embeds; {@link EMBED_FIELD_PROPS} is the legacy JSON
 * mirror still consumed by the not-yet-migrated DM/webhook tools and goes away once
 * those modules adopt this shape.
 */
export const embedFieldsShape = {
  title: z.string().optional().describe("Embed title shown in bold at the top."),
  url: z.string().optional().describe("URL that makes the title clickable."),
  description: z.string().optional().describe("Main body text of the embed (supports Markdown)."),
  color: z.string().optional().describe("Side-bar color as a hex string, e.g. '#5865F2'."),
  fields: z
    .array(
      z.object({
        name: z.string().describe("Field heading."),
        value: z.string().describe("Field body text."),
        inline: z
          .boolean()
          .optional()
          .describe("If true, render this field side-by-side with adjacent inline fields."),
      })
    )
    .optional()
    .describe(
      "Up to 25 name/value field blocks. Set inline:true on a field to render it side-by-side with adjacent inline fields (up to 3 per row)."
    ),
  author: z
    .object({
      name: z.string().describe("Author display name."),
      icon_url: z.string().optional().describe("Small icon shown next to the author name."),
      url: z.string().optional().describe("URL the author name links to."),
    })
    .optional()
    .describe("Author block shown at the top of the embed."),
  thumbnail_url: z.string().optional().describe("Small image shown in the top-right corner."),
  footer: z.string().optional().describe("Footer text shown at the bottom of the embed."),
  image_url: z.string().optional().describe("Large image shown below the embed body."),
  timestamp: z.boolean().optional().describe("If true, stamp the embed with the current time."),
} as const;

/** Schema for a single embed object (e.g. an item of `discord_send_multiple_embeds`). */
export const embedObjectSchema = z.object(embedFieldsShape);

/** Validated embed input — the typed shape `buildEmbed` consumes from migrated tools. */
export type EmbedInput = z.infer<typeof embedObjectSchema>;

/**
 * Builds an EmbedBuilder from a flat args object.
 * Shared by the message, DM, and webhook embed tools. The union param accepts both
 * a validated {@link EmbedInput} (migrated tools) and a raw bag (legacy callers).
 */
export function buildEmbed(args: EmbedInput | Record<string, unknown>): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (args.title) embed.setTitle(args.title as string);
  if (args.url) embed.setURL(args.url as string);
  if (args.description) embed.setDescription(args.description as string);
  if (args.color) embed.setColor(args.color as ColorResolvable);
  if (args.footer) embed.setFooter({ text: args.footer as string });
  if (args.image_url) embed.setImage(args.image_url as string);
  if (args.thumbnail_url) embed.setThumbnail(args.thumbnail_url as string);
  if (args.timestamp) embed.setTimestamp();
  if (args.author) {
    const a = args.author as { name: string; icon_url?: string; url?: string };
    embed.setAuthor({ name: a.name, iconURL: a.icon_url, url: a.url });
  }
  if (args.fields) {
    const fields = args.fields as { name: string; value: string; inline?: boolean }[];
    embed.addFields(fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
  }
  return embed;
}

/** Reusable input-schema fragment for a rich embed's fields (shared by send/edit/multiple embed tools). */
export const EMBED_FIELD_PROPS = {
  title: { type: "string", description: "Embed title shown in bold at the top." },
  url: { type: "string", description: "URL that makes the title clickable." },
  description: { type: "string", description: "Main body text of the embed (supports Markdown)." },
  color: { type: "string", description: "Side-bar color as a hex string, e.g. '#5865F2'." },
  fields: {
    type: "array",
    description: "Up to 25 name/value field blocks. Set inline:true on a field to render it side-by-side with adjacent inline fields (up to 3 per row).",
    items: {
      type: "object",
      properties: {
        name: { type: "string", description: "Field heading." },
        value: { type: "string", description: "Field body text." },
        inline: { type: "boolean", description: "If true, render this field side-by-side with adjacent inline fields." },
      },
      required: ["name", "value"],
    },
  },
  author: {
    type: "object",
    description: "Author block shown at the top of the embed.",
    properties: {
      name: { type: "string", description: "Author display name." },
      icon_url: { type: "string", description: "Small icon shown next to the author name." },
      url: { type: "string", description: "URL the author name links to." },
    },
    required: ["name"],
  },
  thumbnail_url: { type: "string", description: "Small image shown in the top-right corner." },
  footer: { type: "string", description: "Footer text shown at the bottom of the embed." },
  image_url: { type: "string", description: "Large image shown below the embed body." },
  timestamp: { type: "boolean", description: "If true, stamp the embed with the current time." },
} as const;
