const { join } = require('path')
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
const cheerio = require('cheerio')
const nunjucks = require('nunjucks')

const SRC_DIR = 'src'
const INCLUDES_DIR = '_includes'
const IMAGES_PATH = '/images/'
const IMAGES_OUTPUT_PATH = './_site/images/'
const COLLECTION_RANDOM_SIZE = 5

const CONTENT_BANNERS = [
  {
    predicate: (path) =>
      path.includes('/travels/') && !path.includes('/travels/index.html'),
    banners: ['oneday', 'future_travels'],
    step: 7,
  },
  {
    predicate: (path) =>
      path.includes('/routes/') &&
      !path.includes('/routes/oneday/') &&
      !path.includes('/routes/index.html'),
    banners: ['oneday', 'future_travels'],
    step: 3,
  },
]

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1)

const random = (min, max) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const shuffle = (arr) => {
  return arr
    .map((a) => ({
      sort: random(1, arr.length),
      value: a,
    }))
    .sort((a, b) => b.sort - a.sort)
    .map((a) => a.value)
}

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

  config.addTransform('inject-banners', function (content) {
    const path = this.outputPath || ''

    if (!path.endsWith('.html')) {
      return content
    }

    const $ = cheerio.load(content)
    const compiler = nunjucks.configure(join(SRC_DIR, INCLUDES_DIR))
    const template_dir = 'banners'

    CONTENT_BANNERS.forEach((page) => {
      if (!page.predicate(path)) {
        return
      }

      const banners = shuffle(page.banners)
      let current = 0

      banners.forEach((b) => {
        current += page.step

        let $paragraph = $(`.post p:not([class]):nth-of-type(${current})`)

        if (!$paragraph.length) {
          $paragraph = $('.post p:not([class]):last-of-type')
        }

        const template = `{% include '${join(template_dir, `${b}.njk`)}' %}`

        $paragraph.after(compiler.renderString(template))
      })
    })

    return $.html()
  })

  config.addCollection('travel', (api) => {
    const posts = api.getFilteredByTag('travel') || []
    const patchRelated = (post) => {
      post.data.related = posts.filter(
        (p) =>
          p.url !== post.url &&
          post.data.group &&
          p.data.group === post.data.group,
      )
      return post
    }

    return posts.map(patchRelated)
  })

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

    return shuffle([...travels, ...routes, ...articles])
  })

  config.addCollection('travels_random', (api) => {
    return shuffle(api.getFilteredByTag('travel')).slice(
      0,
      COLLECTION_RANDOM_SIZE + 1,
    )
  })

  config.addCollection('routes_random', (api) => {
    return shuffle(api.getFilteredByTag('route')).slice(
      0,
      COLLECTION_RANDOM_SIZE + 1,
    )
  })

  config.addCollection('routes_oneday', (api) => {
    return api
      .getFilteredByTag('route')
      .filter((r) => r.data.days === 1)
      .reverse()
  })

  config.addFilter('monthAndYear', (value) => {
    const date = format(value || new Date(), 'LLLL yyyy', {
      locale: ru,
    })

    return `${capitalize(date)} г.`
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
        widths: [320, 640, 960, 1200],
        formats: ['webp', 'jpeg'],
        urlPath: IMAGES_PATH,
        outputDir: IMAGES_OUTPUT_PATH,
      })

      const imageAttributes = {
        class: 'image',
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
      input: SRC_DIR,
      includes: INCLUDES_DIR,
    },
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['html', 'md', 'njk'],
  }
}
