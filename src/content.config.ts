import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const galleryItem = z.object({ file: z.string().nullable(), caption: z.string().default('') });

// `services` and `guides` were fork leftovers from nicks-repair-shop — no PF page ever rendered
// them and their content directories were empty. Removed 2026-07-27 (Fable audit H4).

const settings = defineCollection({
  loader: glob({ pattern: 'site.json', base: './src/content/settings' }),
  schema: z.object({
    name: z.string(),
    phone: z.string(),
    phoneHref: z.string(),
    email: z.string(),
    address: z.string(),
    heroImage: z.string().nullable().optional(),
    welcomeImage: z.string().nullable().optional(),
    reviewsWidgetId: z.string().optional().default(''),
    hours: z.array(z.object({ day: z.string(), time: z.string() })),
    socials: z.array(z.object({ name: z.string(), brand: z.string(), icon: z.string(), url: z.string(), show: z.boolean() })),
  }).passthrough(),
});

const galleryPhotos = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/gallery' }),
  schema: z.object({
    caption: z.string().optional().default(''),
    image: z.string().nullable().optional(),
    section: z.string().default('home'),
    order: z.number().default(0),
    // Bento span for the homepage gallery: '' | 'b-wide' | 'b-tall'. Must stay in step with
    // keystatic.config.ts or the editor rejects the item.
    cls: z.string().optional().default(''),
  }).passthrough(),
});

const videos = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/videos' }),
  schema: z.object({
    youtube: z.string().optional().default(''),
    section: z.string().default('home'),
    order: z.number().default(0),
  }).passthrough(),
});

export const collections = { settings, galleryPhotos, videos };
