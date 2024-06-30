const sass = require('eleventy-sass')
const markdownIt = require('markdown-it')
const markdownItAnchor = require('markdown-it-anchor')
const markdownItAttrs = require('markdown-it-attrs')
const markdownItFootnote = require('markdown-it-footnote')
const markdownItMultiMdTable = require('markdown-it-multimd-table')
const embedEverything = require('eleventy-plugin-embed-everything')
const pluginRss = require('@11ty/eleventy-plugin-rss')
const Image = require('@11ty/eleventy-img')
const { format } = require('date-fns')
const ru = require('date-fns/locale/ru')

const IMAGES_PATH = '/images/'
const IMAGES_OUTPUT_PATH = './_site/images/'

/** @param {import("@11ty/eleventy").UserConfig} config */
module.exports = (config) => {
  const data = {
    layout: 'layouts/default.njk',
  }

  for (const key in data) {
    const value = data[key]
    config.addGlobalData(key, value)
  }

  config.addPassthroughCopy('src/assets')

  config.addPlugin(pluginRss)
  config.addPlugin(sass, {
    compileOptions: {
      permalink: function (contents, inputPath) {
        return (data) =>
          data.page.filePathStem.replace(/^\/scss\//, '/css/') + '.css'
      },
    },
    sass: {
      style: 'compressed',
      sourceMap: false,
      loadPaths: ['src/_includes/scss'],
      includes: 'src/_includes/scss',
    },
    rev: false,
  })

  config.addPlugin(embedEverything)

  const md = markdownIt({
    html: true,
    linkify: true,
    typographer: true,
  })
    .use(markdownItAttrs)
    .use(markdownItFootnote)
    .use(markdownItMultiMdTable)
    .use(markdownItAnchor, {
      permalink: markdownItAnchor.permalink.linkInsideHeader(),
      level: 2,
    })

  config.setLibrary('md', md)

  config.addCollection('index', (api) => {
    const markPost = (type) => (post) => {
      post.data.type = type
      return post
    }
    const count = 2

    const travels = [...api.getFilteredByTag('travel')]
      .reverse()
      .slice(0, count)
      .map(markPost('travel'))
    const routes = [...api.getFilteredByTag('route')]
      .reverse()
      .slice(0, count)
      .map(markPost('route'))
    const articles = [...api.getFilteredByTag('helpful')]
      .map(markPost('helpful'))
      .reverse()
      .slice(0, count)

    return [...travels, ...routes, ...articles]
  })

  config.addFilter('monthAndYear', (value) => {
    const date = format(value || new Date(), 'LLLL yyyy', {
      locale: ru,
    })

    return date.charAt(0).toUpperCase() + date.slice(1)
  })

  config.addFilter('date', (value) => {
    return format(value || new Date(), 'dd.MM.yyyy')
  })

  config.addFilter('reverse', (arr) => {
    if (!Array.isArray(arr)) {
      return arr
    }
    return [...arr].reverse()
  })

  config.addFilter('dateToRfc3339', pluginRss.dateToRfc3339)
  config.addFilter('dateToRfc822', pluginRss.dateToRfc822)
  config.addFilter(
    'getNewestCollectionItemDate',
    pluginRss.getNewestCollectionItemDate,
  )
  config.addFilter('absoluteUrl', pluginRss.absoluteUrl)
  config.addFilter(
    'convertHtmlToAbsoluteUrls',
    pluginRss.convertHtmlToAbsoluteUrls,
  )

  config.addPairedShortcode('quote', (content, author, position, link) => {
    const authorHtml = author
      ? `<footer class="blockquote__footer">${
          link ? `<a href="${link}">${author}</a>` : author
        }${position ? `, ${position}` : ''}</footer>`
      : ''
    return `
      <blockquote class="blockquote">
        ${content.trim()}
        ${authorHtml}
      </blockquote>
    `
  })

  config.addPairedShortcode('note', (content) => {
    return `
      <div class="note">${content}</div>
    `
  })

  config.addPairedShortcode('figure', (content, caption) => {
    return `<figure class="figure">${content}${
      caption
        ? `<figcaption class="figure__caption">${caption}</figcaption>`
        : ''
    }</figure>`
  })

  config.addShortcode('image_background', async (src, className = '') => {
    const metadata = await Image(src, {
      widths: [1400],
      formats: ['webp'],
      urlPath: IMAGES_PATH,
      outputDir: IMAGES_OUTPUT_PATH,
    })

    const data = metadata.webp[metadata.webp.length - 1]
    const cn = ['image-background', className].join(' ')

    return `<div class="${cn}" style="background-image: url(${data.url})"></div>`
  })

  config.addShortcode(
    'image',
    async (src, alt, sizes = '(min-width: 30em) 50vw, 100vw') => {
      const metadata = await Image(src, {
        widths: [320, 640, 960, 1200, 1800],
        formats: ['webp', 'jpeg'],
        urlPath: IMAGES_PATH,
        outputDir: IMAGES_OUTPUT_PATH,
      })

      const imageAttributes = {
        alt,
        sizes,
        loading: 'lazy',
        decoding: 'async',
      }

      return Image.generateHTML(metadata, imageAttributes)
    },
  )

  return {
    dir: {
      input: 'src',
      includes: '_includes',
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['html', 'md', 'njk'],
  }
}
