import { config, fields, singleton, collection } from '@keystatic/core';
import { createElement } from 'react';

// Storage: LOCAL mode — Albert runs `npm run dev` and edits at
// http://localhost:4321/keystatic. Edits write straight to the files on disk
// (src/content/* and public/images/*); then rebuild + deploy to publish.
// No GitHub app, no secrets, no accounts needed.
export default config({
  storage: { kind: 'local' },
  ui: {
    brand: {
      name: 'PF Clams and Crabs',
      mark: () => createElement('img', { src: '/images/logo.png', height: 28, alt: 'PF Clams and Crabs' }),
    },
    navigation: { Content: ['site', 'galleryPhotos', 'videos'] },
  },
  singletons: {
    site: singleton({
      label: 'Site settings',
      path: 'src/content/settings/site',
      format: { data: 'json' },
      previewUrl: 'https://pfclams.com/',
      schema: {
        name: fields.text({ label: 'Business name' }),
        phone: fields.text({ label: 'Phone (display)', description: 'e.g. (609) 305-3836' }),
        phoneHref: fields.text({ label: 'Phone (dial link)', description: 'e.g. +16093053836' }),
        email: fields.text({ label: 'Email' }),
        address: fields.text({ label: 'Address' }),
        reviewsWidgetId: fields.text({ label: 'Featurable reviews widget ID', description: 'Paste the widget UUID once the Google reviews widget is set up. Leave blank for now.' }),
        hours: fields.array(
          fields.object({
            day: fields.text({ label: 'Day' }),
            time: fields.text({ label: 'Hours', description: 'e.g. 9:00 AM - 2:00 PM, or Call for today’s hours' }),
          }),
          { label: 'Hours', itemLabel: (p) => `${p.fields.day.value}: ${p.fields.time.value}` }
        ),
        socials: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            brand: fields.text({ label: 'Brand slug', description: 'google, facebook, instagram, youtube' }),
            icon: fields.text({ label: 'Font Awesome class', description: 'e.g. fa-brands fa-google' }),
            url: fields.url({ label: 'URL' }),
            show: fields.checkbox({ label: 'Show on site', defaultValue: true }),
          }),
          { label: 'Social links', itemLabel: (p) => p.fields.name.value }
        ),
      },
    }),
  },
  collections: {
    galleryPhotos: collection({
      label: 'Gallery Photos',
      path: 'src/content/gallery/*',
      slugField: 'caption',
      format: { data: 'json' },
      columns: ['caption', 'order'],
      previewUrl: 'https://pfclams.com/#gallery',
      schema: {
        caption: fields.slug({ name: { label: 'Caption', description: 'Shown under the photo and used as the file name.' } }),
        image: fields.image({ label: 'Photo', directory: 'public/images/gallery', publicPath: '/images/gallery/' }),
        section: fields.select({
          label: 'Where it shows',
          options: [{ label: 'Home page gallery', value: 'home' }],
          defaultValue: 'home',
        }),
        cls: fields.select({
          label: 'Tile size',
          description: 'Bento span in the homepage gallery.',
          options: [
            { label: 'Normal', value: '' },
            { label: 'Wide (2 columns)', value: 'b-wide' },
            { label: 'Tall (2 rows)', value: 'b-tall' },
          ],
          defaultValue: '',
        }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0, description: 'Lower numbers show first.' }),
      },
    }),
    videos: collection({
      label: 'Videos (YouTube)',
      path: 'src/content/videos/*',
      slugField: 'title',
      format: { data: 'json' },
      columns: ['title', 'order'],
      previewUrl: 'https://pfclams.com/',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        youtube: fields.text({ label: 'YouTube link or video ID', description: 'Paste the full YouTube URL (or just the 11-character video ID).' }),
        section: fields.select({
          label: 'Where it shows',
          options: [{ label: 'Home page', value: 'home' }],
          defaultValue: 'home',
        }),
        order: fields.integer({ label: 'Sort order', defaultValue: 0 }),
      },
    }),
  },
});
