import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const galleryItem = z.object({ file: z.string().nullable(), caption: z.string().default('') });

const services = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    duty: z.enum(['light', 'heavy']),
    icon: z.string(),
    order: z.number().default(0),
    bullets: z.array(z.string()).default([]),
    lead: z.string().optional(),
    why: z.string().optional(),
    handles: z.array(z.string()).default([]),
  }),
});

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

const guides = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    date: z.coerce.date().optional(),
  }),
});

export const collections = { services, settings, galleryPhotos, videos, guides };
