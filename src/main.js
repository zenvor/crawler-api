import Koa from 'koa'
import KoaRouter from '@koa/router'
import ImageExtractor from './crawler-class.js'
import { config } from './config.js'
import KoaBodyParser from 'koa-bodyparser'
import JSZip from 'jszip'
import { SERVER_PORT } from './config/server.js'

const app = new Koa()
const router = new KoaRouter()

let imageBuffers = []

// 使用 bodyParser 中间件来解析请求体
app.use(KoaBodyParser())

router.post('/extractions', async (ctx, next) => {
  try {
    console.log('ctx: ', ctx.request.body)
    // 从请求体中获取前端传来的 URL
    const { url } = ctx.request.body
    config.targetCrawlingWebPageLink = url
    const imageExtractor = new ImageExtractor(config)
    const { images, imageBuffers: buffers } = await imageExtractor.start()
    imageBuffers = buffers
    // 返回提取的数据
    ctx.status = 200
    ctx.body = { data: [...images] }
  } catch (error) {
    ctx.status = 500
  }
})

router.post('/download/single', async (ctx, next) => {
  const { imageId } = ctx.request.body

  for (const item of imageBuffers) {
    if (imageId == item.id) {
      const imageBuffer = item.imageBuffer
      const filename = item.name + '.' + item.type

      // 设置响应头，告诉浏览器这是一个图片文件
      ctx.set('Content-Type', `image/${item.type}`)
      // 设置响应头，告诉浏览器以附件形式下载图片
      ctx.set('Content-Disposition', `attachment; filename=${filename}`)
      // 将图片文件内容作为响应发送给前端
      // 返回提取的数据
      ctx.status = 200
      ctx.body = imageBuffer
      break
    }
  }
})

router.post('/download/multiple', async (ctx, next) => {
  const { imageIds } = ctx.request.body
  console.log('imageIds: ', imageIds)

  const zip = new JSZip()
  let zipName

  for (const imageId of imageIds) {
    for (const item of imageBuffers) {
      if (imageId == item.id) {
        const imageBuffer = item.imageBuffer
        const fileName = item.name + '.' + item.type
        zipName = item.zipName

        // 将图片添加到ZIP文件中
        zip.file(fileName, imageBuffer)
        break
      }
    }
  }

  // 生成 ZIP 压缩包
  const zipData = await zip.generateAsync({ type: 'nodebuffer' })

  // 将zip文件作为响应发送给前端
  ctx.set('Content-Disposition', `attachment; filename=${zipName}.zip`)
  // 返回提取的数据
  ctx.status = 200
  ctx.body = zipData
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(SERVER_PORT, () => {
  console.log('Server started successfully')
})
