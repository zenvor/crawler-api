import puppeteer from 'puppeteer'
// 检验并生成一个符合 Windows 文件命名规则的文件名
import { validateAndModifyFileName } from './utils/validate-and-modify-file-name.js'
// 根据缩略图获取原图
import { generateOriginalImageUrl } from './utils/generate-original-image-url.js'
// 解析链接
import { parseLink } from './utils/parse-link.js'
import imgSize from 'image-size'
import imageType from 'image-type'
import xml2js from 'xml2js'
import sharp from 'sharp'
import SvgParser from 'svg-parser'
const svgParser = SvgParser.parse

export default class ImageExtractor {
  constructor(config) {
    this.config = config
    this.extractMode = this.config.extractMode
    this.targetCrawlingWebPageLink = this.config.targetCrawlingWebPageLink
    this.targetCrawlingWebPageLinks = this.config.targetCrawlingWebPageLinks
    // 全局浏览器实例
    this.globalBrowser = null
    // 导航浏览器
    this.navigationBrowser = null
    // 网页标题
    this.title = ''
    // 全部图片
    this.images = []
    this.imageBuffers = []
  }

  start() {
    return new Promise(async (resolve) => {
      // 启动一个全局浏览器实例
      this.globalBrowser = await puppeteer.launch({ headless: 'new' })

      switch (this.extractMode) {
        case 'singleSite':
          console.log('\x1b[36m%s\x1b[0m', '开始计时')
          console.time('download time')

          const result = await this.extractImages(this.targetCrawlingWebPageLink)
          resolve(result)
          console.log('this.targetCrawlingWebPageLink: ', this.targetCrawlingWebPageLink)
          break
        case 'multipleSites':
          for (const link of this.targetCrawlingWebPageLinks) {
            if (link) {
              console.log('\x1b[36m%s\x1b[0m', '开始计时')
              console.time('download time')

              const result = await this.extractImages(link)
              resolve(result)
              console.log('link: ', link)
            }
          }
          break
      }
    })
  }

  /**
   * @description 图片提取
   * @param {string} link
   */
  extractImages(link) {
    console.log('link: ', link)
    return new Promise(async (resolve) => {
      // 启动一个新的浏览器实例
      this.navigationBrowser = await puppeteer.launch({ headless: 'new' })
      // 创建一个新的页面
      const page = await this.navigationBrowser.newPage()
      // 设置视口大小
      await page.setViewport({ width: 1600, height: 1000 })
      // 配置导航超时
      // 设置访问图片的超时时间为 300 秒
      const timeoutMilliseconds = 1000 * 500
      // 导航到您想要获取HTML的网址 ['load', 'domcontentloaded', 'networkidle0', 'networkidle2']
      try {
        await page.goto(link, { waitUntil: 'networkidle0', timeout: timeoutMilliseconds })
      } catch (error) {
        console.log('error: ', error);
      }
      // 等待一段时间
      await new Promise((resolve) => setTimeout(resolve, 2000))

      await page.evaluate(async () => {
        // 异步滚动函数，接受两个参数：最大已滚动距离和回调函数
        // async function autoScroll(maxScroll, callback) {
        //   return new Promise((resolve, reject) => {
        //     let lastScrollTime = Date.now() // 记录最后一次滚动的时间
        //     // 获取当前页面的高度
        //     let pageHeight = document.documentElement.scrollHeight
        //     // 获取当前已滚动的距离
        //     let currentScroll = window.scrollY
        //     // 设置一个标志，表示是否到达页面底部
        //     let isBottom = false
        //     // 设置一个标志，表示是否停止滚动
        //     let isStop = false
        //     // 设置一个计时器，用于检测滚动停留时间
        //     let timer = null
        //     // 定义一个内部函数，用于执行滚动操作
        //     function scroll() {
        //       // 如果已经到达页面底部或者超过最大已滚动距离或者停止滚动，就停止滚动，并执行回调函数
        //       if (isBottom || currentScroll >= maxScroll || isStop) {
        //         clearInterval(timer)
        //         callback()
        //         resolve()
        //         return
        //       }
        //       // 每次滚动一定的像素
        //       window.scrollBy(0, 200)
        //       // 更新已滚动的距离
        //       currentScroll = window.scrollY
        //       // 检测是否到达页面底部
        //       if (currentScroll + window.innerHeight >= pageHeight) {
        //         // 如果是第一次到达页面底部，就设置一个定时器，等待2秒
        //         if (!isBottom) {
        //           isBottom = true
        //           timer = setTimeout(scroll, 2000)
        //         }
        //       } else {
        //         // 如果不是到达页面底部，就清除定时器，并继续滚动
        //         isBottom = false
        //         clearTimeout(timer)
        //         timer = setTimeout(scroll, 100)
        //       }
        //       // 检测是否停止滚动
        //       if (Date.now() - lastScrollTime > 1000) {
        //         // 如果超过1000ms没有滚动，就设置停止标志为真
        //         isStop = true
        //       } else {
        //         // 如果还在滚动，就更新最后一次滚动的时间，并设置停止标志为假
        //         lastScrollTime = Date.now()
        //         isStop = false
        //       }
        //     }
        //     // 调用内部函数开始滚动
        //     scroll()
        //   })
        // }

        // 异步滚动函数，接受两个参数：最大已滚动距离和回调函数
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
              window.scrollBy(0, 300)
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

      // 滚动到底部
      async function scrollToEnd(page) {
        return await page.evaluate(async () => {
          return new Promise((resolve) => {
            let lastScrollTime = Date.now() // 记录最后一次滚动的时间
            window.onscroll = () => {
              // 监听滚动事件
              lastScrollTime = Date.now() // 更新最后一次滚动的时间
            }
            let timerId = setInterval(() => {
              // 定时检查是否停止滚动
              if (Date.now() - lastScrollTime > 1000) {
                // 如果超过1000ms没有滚动
                clearInterval(timerId) // 清除定时器
                resolve() // 结束Promise
              } else {
                // 如果还在滚动
                window.scrollBy(0, 500) // 滚动一段距离
              }
            }, 100)
          })
        })
      }

      // 获取页面标题
      this.title = await page.title()

      const { protocolAndDomain } = parseLink(link)

      let images = await page.evaluate((protocolAndDomain) => {
        const elements = Array.from(document.querySelectorAll('a, img, svg, meta')) // 获取所有的 a 和 img 元素

        return elements
          .map((element) => {
            if (element.tagName === 'A') {
              let url = element.getAttribute('href')
              url = handleImageLink(url, protocolAndDomain)
              if (isImageLink(url)) return url
              return null
            } else if (element.tagName === 'IMG') {
              let url = element.getAttribute('src')
              url = handleImageLink(url, protocolAndDomain)
              if (url) return url
              return null
            } else if (element.tagName === 'svg') {
              const svgContent = new XMLSerializer().serializeToString(element)
              // 编码后的SVG内容
              const encodedSvgContent = encodeURIComponent(svgContent)
              console.log('encodedSvgContent: ', encodedSvgContent)
              return `data:image/svg+xml,${encodedSvgContent}`
            } else if (element.tagName === 'META') {
              let content = element.getAttribute('content')
              content = handleImageLink(content, protocolAndDomain)
              if (isImageLink(content)) return content
              return null
            }
            return null // 返回 null 表示不是图片链接
          })
          .filter((link) => link !== null)
          .concat(extractImagesFromCssStyles())
          .concat(extractFavicon())

        function extractImagesFromCssStyles() {
          const elements = document.querySelectorAll('[class]')
          const images = []

          // 遍历每个元素
          for (let element of elements) {
            const style = window.getComputedStyle(element)

            const backgroundImage = style.getPropertyValue('background-image')

            const svg = style.getPropertyValue('--svg')

            if (svg && (svg.startsWith('url("data:') || svg.startsWith('url("http'))) {
              images.push(extractImageLinkFromCssPropertyValue(svg))
            } else if (
              backgroundImage &&
              (backgroundImage.startsWith('url("data:') || backgroundImage.startsWith('url("http'))
            ) {
              images.push(extractImageLinkFromCssPropertyValue(backgroundImage))
            }
          }

          function extractImageLinkFromCssPropertyValue(cssPropertyValue) {
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

        function handleImageLink(url, protocolAndDomain) {
          if (url) {
            url = url.replace(/_webp$/, '')

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
        function isImageLink(url) {
          // 定义一个正则表达式，匹配以常见图片文件扩展名结尾的字符串
          let regex = /(https?:\/\/).*\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff)$/i // 使用不区分大小写的标志 'i'
          // 调用test()方法，检查url是否符合正则表达式
          return regex.test(url)
        }
      }, protocolAndDomain)

      // 使用 Set 去重
      images = [...new Set(images)]

      const handleImage = (page, url) => {
        return new Promise(async (resolve) => {
          try {
            // 设置访问图片的超时时间为 180 秒
            const timeoutMilliseconds = 1000 * 180
            const response = await page.goto(url, { timeout: timeoutMilliseconds })
            let imageBuffer
            const contentType = response.headers()['content-type']

            if (contentType && contentType.startsWith('image/')) {
              console.log('This response is an image.')
              imageBuffer = await response.buffer()
            } else {
              console.log('This response is not an image.')
              return resolve()
            }

            let type, name, width, height, imageSize, fileSize
            const id = generateId()
            const zipName = parseLinkReturnDomain(link) + '-' + new Date().getTime()
            fileSize = imageBuffer.length
            name = extractImageNameAndFileName(url, id).imageName || ''
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
                width = parseInt(parts[2])
                height = parseInt(parts[3])
              } else {
                // 提取宽度和高度
                width = parseInt(parsed.children[0].properties.width)
                height = parseInt(parsed.children[0].properties.height)
              }

              imageSize = width * height
            } else if (isAVIF(imageBuffer)) {
              try {
                // 使用 Sharp 将 AVIF 图像 buffer 转换为 JPEG 图像 buffer
                const jpegBuffer = await sharp(imageBuffer)
                  .jpeg() // 指定目标格式为 JPEG
                  .toBuffer()

                const imageSizeResult = imgSize(jpegBuffer)

                type = getImageFormatFromBuffer(jpegBuffer)

                width = parseInt(imageSizeResult.width)
                height = parseInt(imageSizeResult.height)
                imageSize = width * height

                imageBuffer = jpegBuffer
              } catch (error) {
                console.error('Error:', error)
              }
            } else {
              try {
                const imageSizeResult = imgSize(imageBuffer)

                type = getImageFormatFromBuffer(imageBuffer)

                width = parseInt(imageSizeResult.width)
                height = parseInt(imageSizeResult.height)

                imageSize = width * height
              } catch (error) {
                console.log('Error: ', error)
              }
            }

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
              zipName: zipName ?? null,
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
            const page = await this.globalBrowser.newPage()
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

      resolve({ images: this.images, imageBuffers: this.imageBuffers })

      this.navigationBrowser.close()
      this.globalBrowser.close()

      function isSVG(buffer) {
        const bufferString = buffer.toString('utf-8', 0, 100) // 读取前100个字符（根据需要适当调整）
        return bufferString.includes('<svg')
      }

      function isAVIF(buffer) {
        const avifHeader = buffer.toString('utf-8', 4, 12) // 读取文件头部的8个字符
        // 检查是否包含 "ftypavif"
        return avifHeader === 'ftypavif'
      }

      function generateId() {
        // 生成一个 UUID（随机唯一标识符）
        function generateUUID() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (Math.random() * 16) | 0,
              v = c === 'x' ? r : (r & 0x3) | 0x8
            return v.toString(16)
          })
        }

        // 生成唯一的 ID
        const id = generateUUID()

        return id
      }

      function parseLinkReturnDomain(link) {
        // 创建一个URL对象，传入链接字符串
        let urlObj = new URL(link)
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
       * 是否为图像链接
       * @param {string} url
       * @returns
       */
      function isImageLink(url) {
        // 定义一个正则表达式，匹配以常见图片文件扩展名结尾的字符串
        let regex = /(https?:\/\/).*\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff)$/i // 使用不区分大小写的标志 'i'
        // 调用test()方法，检查url是否符合正则表达式
        return regex.test(url)
      }

      /**
       * 提取链接中的图片名和文件名
       * @param {string} url
       * @returns
       */
      function extractImageNameAndFileName(imageUrl, id) {
        if (isDataUrl(imageUrl)) {
          return getFileNameFromDataUrl(imageUrl, id)
        } else {
          return getImageNameAndFileName(imageUrl, id)
        }

        function isDataUrl(url) {
          // 检查链接是否以"data:"开头
          if (url.startsWith('data:')) {
            // 如果是，返回true
            return true
          } else {
            // 如果不是，返回false
            return false
          }
        }

        function getImageNameAndFileName(imageUrl, id) {
          // 用"/"分割图片链接，得到一个数组
          let parts = imageUrl.split('/')
          // 取数组的最后一个元素，即文件名字
          let fileName = parts[parts.length - 1]
          if (fileName.includes('?')) fileName = fileName.split('?')[0]

          let re = /\.\w+$/ // 定义一个正则表达式，匹配以.开头的任意字母或数字结尾的部分
          if (re.test(fileName)) {
            // 如果文件名匹配正则表达式，说明已经有文件扩展名
            // 用"."分割文件名字，得到一个数组
            let subparts = fileName.split('.')
            // 取数组的第一个元素，即图片名字
            let imageName = subparts[0]
            // 返回一个对象，包含图片名字和文件名字
            return {
              imageName: imageName,
              fileName: fileName,
            }
          } else {
            // 否则，说明没有文件扩展名
            let imageName = id
            let fileName = null
            // 返回文件名字
            return {
              imageName,
              fileName,
            }
          }
        }

        function getFileNameFromDataUrl(imageUrl, id) {
          // 用","分割图片链接，得到一个数组
          let parts = imageUrl.split(',')
          // 取数组的第一个元素，即数据URI的前缀
          let prefix = parts[0]
          // 用";"分割前缀，得到一个数组
          let subparts = prefix.split(';')
          // 取数组的第一个元素，即MIME类型
          let mimeType = subparts[0]
          // 去掉"data:"前缀
          mimeType = mimeType.slice(5)
          // 根据MIME类型来判断文件的扩展名
          let extension = ''
          switch (mimeType) {
            case 'image/svg+xml':
              extension = '.svg'
              break
            case 'image/png':
              extension = '.png'
              break
            case 'image/jpeg':
              extension = '.jpg'
              break
            // 其他类型可以自行添加
            default:
              extension = null
          }

          let imageName = id
          let fileName = ''

          if (extension) {
            fileName = id + extension
          } else {
            fileName = null
          }

          // 返回文件名字
          return {
            imageName,
            fileName,
          }
        }
      }
    })
  }

  /**
   * @description 判断文件名是否有包含文件扩展名，如果没有默认加上.png
   * @param {*} filename
   * @returns
   */
  addExtension(filename) {
    // 定义一个函数，接受一个文件名作为参数
    let ext = '.png' // 定义一个变量，存储默认的文件扩展名
    let re = /\.\w+$/ // 定义一个正则表达式，匹配以.开头的任意字母或数字结尾的部分
    if (re.test(filename)) {
      // 如果文件名匹配正则表达式，说明已经有文件扩展名
      return filename // 直接返回文件名
    } else {
      // 否则，说明没有文件扩展名
      return filename + ext // 在文件名后面加上默认的文件扩展名，并返回
    }
  }
}
