import puppeteer from 'puppeteer'
import axios from 'axios'
import sizeOf from 'image-size'
import imageType from 'image-type'
import xml2js from 'xml2js'
import sharp from 'sharp'
import SvgParser from 'svg-parser'
import { v4 } from 'uuid'
// 根据缩略图获取原图
import { generateOriginalImageUrl } from './utils/generate-original-image-url.js'
// 解析链接
import { parseUrl } from './utils/parse-url.js'
import { config } from './config.js'
const svgParser = SvgParser.parse

const uuidV4 = v4

import { globalWs } from './main.js'

export default class ImageExtractor {
  constructor(config) {
    this.config = config
    // 提取模式
    this.extractMode = config.extractMode
    // 匹配机制
    this.matchingMechanism = config.matchingMechanism
    // 网站链接
    this.url = config.url
    // 多个网站链接
    this.urls = config.urls
    // 浏览器实例
    this.browser = null
    // 网页标题
    this.title = undefined
    // 图像
    this.images = []
    // 图像 buffer
    this.imageBuffers = []
  }

  /**
   * @description 提取图像
   */
  extractImages() {
    const handler = async (url) => {
      if (!url) return
      console.log('\x1b[36m%s\x1b[0m', `提取的链接${url}`)

      return new Promise(async (resolve) => {
        // 启动一个新的浏览器实例
        this.browser = await puppeteer.launch({ headless: false })

        globalWs.send(JSON.stringify({ message: 'Waiting for browser...', progress: 10 }))
        console.log('提取进度', '10%')

        // 创建一个新的页面
        const page = await this.browser.newPage()

        globalWs.send(JSON.stringify({ message: 'Waiting for browser...', progress: 15 }))
        console.log('提取进度', '15%')

        // 设置视口大小
        await page.setViewport({ width: 1600, height: 1000 })

        globalWs.send(JSON.stringify({ message: 'Waiting for browser...', progress: 20 }))
        console.log('提取进度', '20%')

        // 加载页面
        await this.loadingPage(page)

        // 向下滚动
        await this.scrollingDown(page)

        // 查找图像
        const images = await this.findingImages(page)

        // 分析图像
        const response = await this.analyzingImages(images)

        globalWs.send(JSON.stringify({ message: 'Done...', progress: 100 }))
        console.log('提取完成', '100%')

        resolve(response)
      })
    }

    return new Promise(async (resolve) => {
      switch (this.extractMode) {
        case 'singleSite':
          console.log('\x1b[36m%s\x1b[0m', '开始计时')
          console.time('download time')

          try {
            const result = await handler(this.url)
            resolve(result)
          } catch (error) {
            console.log('error: ', error)
          }

          break
        case 'multipleSites':
          for (const url of this.urls) {
            console.log('\x1b[36m%s\x1b[0m', '开始计时')
            console.time('download time')
            try {
              const result = await handler(url)
              resolve(result)
            } catch (error) {
              console.log('error: ', error)
            }
          }
          break
      }
    })
  }

  /**
   * @description 加载页面
   * @param {object} page
   * @returns
   */
  loadingPage(page) {
    return new Promise(async (resolve) => {
      try {
        // 设置访问图像的超时时间为 300 秒
        const timeoutMilliseconds = 1000 * 500

        setTimeout(() => {
          globalWs.send(JSON.stringify({ message: 'Loading page...', progress: 25 }))
          console.log('加载页面...')
          console.log('提取进度', '25%')
        }, 200)

        setTimeout(() => {
          globalWs.send(JSON.stringify({ message: 'Loading page...', progress: 30 }))
          console.log('提取进度', '30%')
        }, 500)

        setTimeout(() => {
          globalWs.send(JSON.stringify({ message: 'Loading page...', progress: 35 }))
          console.log('提取进度', '35%')
        }, 1000)

        // 导航到您想要获取HTML的网址 ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
        await page.goto(this.url, { waitUntil: 'networkidle0', timeout: timeoutMilliseconds })

        // 获取页面标题
        this.title = await page.title()
        console.log('\x1b[36m%s\x1b[0m', `网页标题${this.title}`)

        globalWs.send(JSON.stringify({ message: 'Loading page...', progress: 40 }))
        console.log('页面加载完成')
        console.log('提取进度', '40%')
      } catch (error) {
        console.log('error: ', error)
      }
      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 2000))

      resolve()
    })
  }

  /**
   * @description 向下滚动
   * @returns
   */
  scrollingDown(page) {
    return new Promise(async (resolve) => {
      globalWs.send(JSON.stringify({ message: 'Scrolling down...', progress: 45 }))
      console.log('向下滚动...')
      console.log('提取进度', '45%')

      globalWs.send(JSON.stringify({ message: 'Scrolling down...', progress: 50 }))
      console.log('提取进度', '50%')

      await page.evaluate(async () => {
        // 异步滚动函数，接受一个参数：最大已滚动距离
        async function autoScroll(maxScroll) {
          return new Promise((resolve) => {
            let lastScrollTime = Date.now() // 记录最后一次滚动的时间
            window.onscroll = () => {
              // 监听滚动事件
              lastScrollTime = Date.now() // 更新最后一次滚动的时间
              // 如果还在滚动，就更新最后一次滚动的时间，并设置停止标志为假
              isStop = false
            }
            // 获取当前已滚动的距离
            let currentScroll = window.scrollY
            // 设置一个标志，表示是否停止滚动
            let isStop = false
            // 设置一个计时器，用于检测滚动停留时间
            let timer = null
            // 定义一个内部函数，用于执行滚动操作
            function scroll() {
              // 如果超过最大已滚动距离或者停止滚动，就停止滚动，并执行回调函数
              if (currentScroll >= maxScroll || isStop) {
                clearInterval(timer)
                console.log('自动滚动完成！')
                resolve()
                return
              }
              // 每次滚动一定的像素
              window.scrollBy(0, 500)
              // 更新已滚动的距离
              currentScroll = window.scrollY
              // 检测是否停止滚动
              if (Date.now() - lastScrollTime > 1000) {
                // 如果超过 1000ms 没有滚动，就设置停止标志为真
                isStop = true
              }
              // 设置一个定时器，继续滚动
              timer = setTimeout(scroll, 100)
            }
            // 调用内部函数开始滚动
            scroll()
          })
        }

        // 调用异步函数，传入最大已滚动距离为20000像素，回调函数为打印一条消息
        await autoScroll(20000)
      })

      globalWs.send(JSON.stringify({ message: 'Scrolling down...', progress: 60 }))
      console.log('提取进度', '60%')

      resolve()
    })
  }
  /**
   * @description 查找图像
   * @returns
   */
  findingImages(page) {
    return new Promise(async (resolve) => {
      const { protocolAndDomain } = parseUrl(this.url)

      globalWs.send(JSON.stringify({ message: 'Finding images...', progress: 65 }))
      console.log('查找图像...')
      console.log('提取进度', '65%')

      globalWs.send(JSON.stringify({ message: 'Finding images...', progress: 70 }))
      console.log('提取进度', '70%')

      globalWs.send(JSON.stringify({ message: 'Finding images...', progress: 75 }))
      console.log('提取进度', '75%')

      globalWs.send(JSON.stringify({ message: 'Finding images...', progress: 80 }))
      console.log('提取进度', '80%')

      let images = await page.evaluate((protocolAndDomain) => {
        const elements = Array.from(document.querySelectorAll('a, img, svg, use, meta, link')) // 获取所有的 a 和 img 元素
        return elements
          .map((element) => {
            if (element.tagName === 'A') {
              let url = element.getAttribute('href')
              url = handleImageUrl(url, protocolAndDomain)
              if (isImageUrl(url)) return url
              return null
            } else if (element.tagName === 'IMG') {
              let url = element.getAttribute('src')
              url = handleImageUrl(url, protocolAndDomain)
              if (url) return url
              return null
            } else if (element.tagName === 'svg') {
              const svgContent = new XMLSerializer().serializeToString(element)
              // 编码后的SVG内容
              const encodedSvgContent = encodeURIComponent(svgContent)
              return `data:image/svg+xml,${encodedSvgContent}`
            } else if (element.tagName === 'use') {
              // 通过xlink:href获取目标symbol的内容
              const symbolId = element.getAttribute('xlink:href').slice(1) // 去掉#获取symbol的id
              const symbolEl = document.getElementById(symbolId)
              const svgData = symbolEl.outerHTML

              const svg = `
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  ${svgData}  
                  <use href="#${symbolId}"/>
                  </svg>
                `
              const encodedSvg = encodeURIComponent(svg)
              const svgUrl = `data:image/svg+xml,${encodedSvg}`
              return svgUrl
            } else if (element.tagName === 'META') {
              let content = element.getAttribute('content')
              content = handleImageUrl(content, protocolAndDomain)
              if (isImageUrl(content)) return content
              return null
            } else if (element.tagName === 'LINK') {
              let content = element.getAttribute('href')
              content = handleImageUrl(content, protocolAndDomain)
              if (isImageUrl(content)) return content
              return null
            }
            return null // 返回 null 表示不是图像链接
          })
          .concat(extractImagesFromCssStyles())
          .concat(extractFavicon())
          .filter((url) => url != null)

        function extractImagesFromCssStyles() {
          const elements = document.querySelectorAll('[class]')
          const images = []

          // 遍历每个元素
          for (let element of elements) {
            const style = window.getComputedStyle(element)

            const backgroundImage = style.getPropertyValue('background-image')

            const svg = style.getPropertyValue('--svg')

            if (svg && (svg.startsWith('url("data:') || svg.startsWith('url("http'))) {
              images.push(extractImageUrlFromCssPropertyValue(svg))
            } else if (
              backgroundImage &&
              (backgroundImage.startsWith('url("data:') || backgroundImage.startsWith('url("http'))
            ) {
              images.push(extractImageUrlFromCssPropertyValue(backgroundImage))
            }
          }

          function extractImageUrlFromCssPropertyValue(cssPropertyValue) {
            if (cssPropertyValue.startsWith('url("data:')) {
              // 如果背景图像属性是一个data URL
              // 提取data URL中的图像数据
              const imageData = cssPropertyValue.slice(5, -2)
              const svgUrl = decodeURIComponent(imageData)
              return svgUrl
            } else if (cssPropertyValue.startsWith('url("http')) {
              // 如果背景图像属性是一个有效的链接
              // 提取链接中的图像地址
              const imageUrl = cssPropertyValue.slice(5, -2)
              return imageUrl
            }
          }

          // 返回包含图像数据的数组
          return images
        }

        function extractFavicon() {
          const href =
            document.querySelector('link[rel="shortcut icon"]')?.href ||
            document.querySelector('link[rel="icon"]')?.href
          if (href) return [href]
        }

        function handleImageUrl(url, protocolAndDomain) {
          if (url) {
            if (!url.startsWith('http')) {
              return (url = `${protocolAndDomain}` + url)
            } else {
              return url
            }
          }
        }

        /**
         * 是否为图像链接
         * @param {string} url
         * @returns
         */
        function isImageUrl(url) {
          // 定义一个正则表达式，匹配以常见图像文件扩展名结尾的字符串
          let regex = /(https?:\/\/).*\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff)$/i // 使用不区分大小写的标志 'i'
          // 调用test()方法，检查url是否符合正则表达式
          return regex.test(url)
        }
      }, protocolAndDomain)

      images.forEach((url) => {
        if (url.includes('_webp')) {
          const jpegUrl = url.replace('_webp', '')
          images.push(jpegUrl)
        }
      })

      // 使用 Set 去重
      images = Array.from(new Set(images))
      console.log(`提取的图像`, images)
      console.log(`提取的图像的个数`, images.length)

      resolve(images)
    })
  }

  /**
   * @description 分析图像
   * @param {array} images
   * @returns
   */
  analyzingImages(images) {
    if (this.matchingMechanism == 'default') {
      setTimeout(() => {
        globalWs.send(JSON.stringify({ message: 'Analyzing images...', progress: 85 }))
        console.log('分析图像...')
      }, 200)

      setTimeout(() => {
        globalWs.send(JSON.stringify({ message: 'Analyzing images...', progress: 90 }))
        console.log('分析图像...', '90%')
      }, 500)
    }

    return new Promise(async (resolve) => {
      // 启动一个全局浏览器实例
      if (!this.browser) {
        this.browser = await puppeteer.launch({ headless: false })
      }

      const handleImage = (page, url) => {
        return new Promise(async (resolve) => {
          if (!url) return resolve()
          console.log('-------------------------------------------------------------------------------')
          console.log('当前正在分析的链接', url)
          try {
            let imageBuffer, response, contentType
            // 设置访问图像的超时时间为 180 秒
            const timeoutMilliseconds = 1000 * 180

            if (this.matchingMechanism == 'original' && url.includes('https://chpic.su')) {
              response = await axios({
                url,
                responseType: 'arraybuffer',
                timeout: timeoutMilliseconds,
              })
              contentType = response.headers.get('Content-Type')
              imageBuffer = Buffer.from(response.data, 'binary')
            } else {
              response = await page.goto(url, { timeout: timeoutMilliseconds })
              contentType = response.headers()['content-type']
              imageBuffer = await response.buffer()
            }

            const whiteList = [
              'image/',
              'application/octet-stream',
              'application/binary',
              'application/x-binary',
              'application/x-octet-stream	',
            ]
            const isPass = whiteList.some((item) => contentType?.startsWith(item))
            if (!isPass) return resolve()

            let type, name, width, height, imageSize, fileSize
            const id = generateId()
            const filename = parseUrlReturnDomain(url) + '-' + new Date().getTime()
            config.filename = filename
            fileSize = imageBuffer.length

            name = extractFileName(url) || ''
            if (isSVG(imageBuffer)) {
              type = 'svg'
              // 将SVG buffer转换为字符串
              const svgString = imageBuffer.toString()

              // 调用parse方法，传入svg字符串参数
              const parsed = svgParser(svgString)

              const viewBoxValue = parsed.children[0].properties.viewBox

              if (viewBoxValue) {
                // 使用空格分割viewBox值
                const parts = viewBoxValue.split(' ')
                // 提取宽度和高度
                width = parseInt(parts[2] || 0)
                height = parseInt(parts[3] || 0)
              } else {
                // 提取宽度和高度
                width = parseInt(parsed.children[0].properties.width || 0)
                height = parseInt(parsed.children[0].properties.height || 0)
              }

              imageSize = width * height
            } else if (isAVIF(imageBuffer)) {
              // 使用 Sharp 将 AVIF 图像 buffer 转换为 JPEG 图像 buffer
              const jpegBuffer = await sharp(imageBuffer)
                .jpeg() // 指定目标格式为 JPEG
                .toBuffer()

              const imageSizeResult = sizeOf(jpegBuffer)

              type = getImageFormatFromBuffer(jpegBuffer)

              width = parseInt(imageSizeResult.width || 0)
              height = parseInt(imageSizeResult.height || 0)
              imageSize = width * height

              imageBuffer = jpegBuffer
            } else if (isICO(imageBuffer)) {
              const dimensions = sizeOf(imageBuffer)

              type = dimensions.type
              width = parseInt(dimensions.width || 0) // 图像宽度
              height = parseInt(dimensions.height || 0) // 图像高度
              imageSize = width * height
            } else {
              const imageSizeResult = sizeOf(imageBuffer)

              type = getImageFormatFromBuffer(imageBuffer)
              width = parseInt(imageSizeResult.width || 0)
              height = parseInt(imageSizeResult.height || 0)
              imageSize = width * height
            }

            // if (width == 0 || height == 0) return resolve()

            this.images.push({
              id: id ?? null,
              url: url ?? null,
              name: name ?? null,
              type: type ?? 'Unknown',
              width: width ?? null,
              height: height ?? null,
              imageSize: imageSize ?? null,
              fileSize: fileSize ?? null,
            })

            this.imageBuffers.push({
              id: id ?? null,
              name: name ?? null,
              type: type ?? 'Unknown',
              imageBuffer: imageBuffer ?? null,
            })
            resolve()
          } catch (error) {
            console.log('Error: ', error)
            console.log(url)
            resolve()
          }
        })
      }

      // 随机请求间隔（毫秒）
      let randomInterval = 0
      // 请求的开始时间（每一轮）
      let startTime = 0
      // 请求的结束时间（每一轮）
      let endTime = 0

      /* 随机化请求间隔：为了更好地模拟真实用户的行为，在请求之间添加随机的时间间隔，
        而不是固定的间隔。这可以减少模式化的请求，降低被识别为爬虫的概率。 */
      for (let i = 0; i < images.length; i += 100) {
        const batchUrls = images.slice(i, i + 100)
        const timeRemaining = randomInterval - (endTime - startTime)
        if (timeRemaining > 0) {
          randomInterval = timeRemaining
          // 设置请求间隔：在发送连续请求之间添加固定的时间间隔，以减缓请求的频率。
          await new Promise((resolve) => setTimeout(resolve, randomInterval))
        }
        // 请求的开始时间（每一轮）
        startTime = Date.now() % 10000
        await Promise.all(
          batchUrls.map(async (url) => {
            // 创建一个新的页面
            const page = await this.browser.newPage()
            // 设置请求头
            await page.setExtraHTTPHeaders({
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
            })

            await handleImage(page, url)
          })
        )
        // 请求的结束时间（每一轮）
        endTime = Date.now() % 10000
        // 随机生成请求间隔
        randomInterval = Math.floor(Math.random() * (1000 - 500 + 1) + 500)
      }

      // 关闭浏览器
      this.browser.close()
      this.browser = null

      resolve({ images: this.images, imageBuffers: this.imageBuffers })
    })

    function isSVG(buffer) {
      const bufferString = buffer.toString('utf-8', 0, 100) // 读取前100个字符（根据需要适当调整）
      return bufferString.includes('<svg')
    }

    function isAVIF(buffer) {
      const avifHeader = buffer.toString('utf-8', 4, 12) // 读取文件头部的8个字符
      // 检查是否包含 "ftypavif"
      return avifHeader === 'ftypavif'
    }

    function isICO(buffer) {
      // ICO文件的标识符：00 00 01 00
      const icoIdentifier = Buffer.from([0x00, 0x00, 0x01, 0x00])

      // 检查前4个字节是否匹配ICO标识符
      const bufferPrefix = buffer.slice(0, 4)
      return bufferPrefix.equals(icoIdentifier)
    }

    function generateId() {
      return uuidV4()
    }

    function parseUrlReturnDomain(url) {
      // 创建一个URL对象，传入链接字符串
      let urlObj = new URL(url)
      // 获取URL对象的hostname属性，即域名
      let domain = urlObj.hostname
      // 返回域名
      return domain
    }

    function getImageFormatFromBuffer(buffer) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        return 'jpeg'
      } else if (buffer[0] === 0x89 && buffer.toString('utf8', 1, 4) === 'PNG') {
        return 'png'
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        return 'gif'
      } else if (
        buffer[0] === 0x52 && // R
        buffer[1] === 0x49 && // I
        buffer[2] === 0x46 && // F
        buffer[3] === 0x46 && // F
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      ) {
        return 'webp'
      } else if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
        return 'bmp'
      }
      return 'Unknown'
    }

    /**
     * 提取链接中的图像名和文件名
     * @param {string} url
     * @returns
     */
    function extractFileName(imageUrl) {
      // 获取 URL 的路径部分
      const path = imageUrl.split('?')[0]

      // 获取文件名
      const fileName = path.split('/').pop()

      return fileName
    }
  }

  /**
   * @description 匹配原图
   * @param {array} images
   * @param {string} link
   * @returns
   */
  matchTheOriginalImage(images, link) {
    return new Promise(async (resolve) => {
      let originalImageUrls = []
      if (link.includes('eroticbeauties')) {
        // 使用 page.evaluate 方法在页面上下文中执行 JavaScript 代码
        originalImageUrls = await page.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span.jpg')) // 获取页面中所有具有 "jpg" 类名的 <span> 元素

          // 使用 Array.map 方法获取每个 <span> 元素的 data-src 属性的值
          const dataSrcValues = spans.map((span) => span.getAttribute('data-src'))

          return dataSrcValues
        })
      } else if (link.includes('alsasianporn')) {
        originalImageUrls = await page.evaluate(() => {
          const as = Array.from(document.querySelectorAll('a[data-fancybox="gallery"]')) // 获取页面中所有具有 "jpg" 类名的 <span> 元素

          // 使用 Array.map 方法获取每个 <span> 元素的 data-src 属性的值
          const hrefValues = as.map((span) => span.getAttribute('href'))

          return hrefValues
        })
      } else if (link.includes('japanesesexpic') || link.includes('asianpussypic')) {
        originalImageUrls = await page.evaluate(() => {
          const as = Array.from(document.querySelectorAll('a[target="_blank"]')) // 获取页面中所有具有 "jpg" 类名的 <span> 元素

          // 使用 Array.map 方法获取每个 <span> 元素的 data-src 属性的值
          const hrefValues = as.map((span) => span.getAttribute('href'))

          return hrefValues
        })
      } else if (link.includes('https://chpic.su')) {
        originalImageUrls = images
          .map((image) => generateOriginalImageUrl(image.url, 'transparent'))
          .filter((imageUrl) => imageUrl != '')

        const originalImageUrlsOtherTypes = images
          .map((image) => generateOriginalImageUrl(image.url, 'white'))
          .filter((imageUrl) => imageUrl != '')

        originalImageUrls = originalImageUrls.concat(originalImageUrlsOtherTypes)
      } else {
        originalImageUrls = images
          .map((image) => generateOriginalImageUrl(image.url))
          .filter((imageUrl) => imageUrl != '')
      }

      console.log('originalImageUrls: ', originalImageUrls)
      console.log('originalImageUrls.length: ', originalImageUrls.length)

      const response = await this.analyzingImages(originalImageUrls)

      resolve(response)
    })
  }
}
