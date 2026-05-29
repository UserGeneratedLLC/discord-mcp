import { EmbedBuilder, ColorResolvable } from "discord.js";

/**
 * Builds an EmbedBuilder from a flat args object.
 * Shared by the message, DM, and webhook embed tools.
 */
export function buildEmbed(args: Record<string, unknown>): EmbedBuilder {
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
