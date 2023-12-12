import Koa from 'koa'
import stream from 'stream'
import KoaRouter from '@koa/router'
import moment from 'moment'
import crypto from 'crypto'
import { v4 } from 'uuid'
import ImageExtractor from './crawler-class.js'
import KoaBodyParser from 'koa-bodyparser'
import JSZip from 'jszip'
import { WebSocketServer } from 'ws'
import { SERVER_PORT } from './config/server.js'
import { config } from './config.js'

const app = new Koa()

const router = new KoaRouter()

// 使用 bodyParser 中间件来解析请求体
app.use(KoaBodyParser())

const uuidV4 = v4

let id,
  url,
  images = [],
  images_count = 0,
  imageBuffers = [],
  originalImages = [],
  originalImageBuffers = [],
  originalImages_count = 0,
  status = 'pending'
export let globalWs = null

const formattedDate = moment().format('YYYY-MM-DD hh:mm:ss')

function generateUniqueHash() {
  return crypto.createHash('sha1').update(Math.random().toString()).digest('hex')
}

function generateUuid() {
  return uuidV4()
}

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  console.log('The client is connected.')

  globalWs = ws

  ws.on('message', async (message) => {
    // 收到消息
    console.log('收到消息: ', message.toString())
    const parsedMessage = JSON.parse(message.toString())
    status = parsedMessage.status
    if (status == 'running') {
      config.url = url
      config.matchingMechanism = 'default'
      const imageExtractor = new ImageExtractor(config)
      const response = await imageExtractor.extractImages()
      images = response.images
      images_count = images.length
      imageBuffers = response.imageBuffers
    }
  })

  ws.send(JSON.stringify({ message: 'Waiting for browser...', progress: 5 }))
})

router.post('/extractions', async (ctx, next) => {
  // FIXME: 暂时这样写
  id = '',
  url = '',
  images = [],
  images_count = 0,
  imageBuffers = [],
  originalImages = [],
  originalImageBuffers = [],
  originalImages_count = 0,
  status = 'pending'

  try {
    const requestBody = ctx.request.body
    url = requestBody.url

    const created_at = formattedDate
    const hash = generateUniqueHash()
    id = generateUuid()
    const options = { mode: 'advanced' }
    const trigger = 'web'
    const updated_at = formattedDate
    const user_id = null

    const extraction = {
      created_at,
      hash,
      id,
      options,
      status,
      trigger,
      updated_at,
      url: requestBody.url,
      user_id,
    }

    ctx.body = { extraction }
  } catch (error) {
    console.log('error: ', error)
    ctx.status = 500
  }
})

router.get('/extractions/:id', async (ctx, next) => {
  try {
    // 从请求体中获取前端传来的 URL
    const { id } = ctx.request.params
    const created_at = formattedDate
    const hash = generateUniqueHash()
    const options = { mode: 'advanced' }
    const status_changed_at = formattedDate
    const trigger = 'web'
    const updated_at = formattedDate
    const user_id = null
    const message = null
    const project_id = null

    const body = {
      created_at,
      hash,
      id,
      images,
      images_count,
      message,
      project_id,
      options,
      status,
      status_changed_at,
      trigger,
      updated_at,
      url,
      user_id,
    }

    ctx.body = body
  } catch (error) {
    console.log('error: ', error)
    ctx.status = 500
  }
})

router.get('/matchingMechanism/:id/:mechanism', async (ctx, next) => {
  try {
    // 从请求体中获取前端传来的 URL
    const { id, mechanism } = ctx.request.params
    console.log('ctx.request.params: ', ctx.request.params)
    const created_at = formattedDate
    const hash = generateUniqueHash()

    config.matchingMechanism = mechanism

    if ((mechanism == 'original' && !originalImages.length) || (mechanism == 'default' && !images.length)) {
      const imageExtractor = new ImageExtractor(config)
      const response = await imageExtractor.matchTheOriginalImage(images, url)

      originalImages = response.images
      originalImageBuffers = response.imageBuffers
      originalImages_count = originalImages.length
    }

    const options = { mode: 'advanced' }
    const status_changed_at = formattedDate
    const trigger = 'web'
    const updated_at = formattedDate
    const user_id = null
    const message = null
    const project_id = null

    const body = {
      created_at,
      hash,
      id,
      images: mechanism == 'default' ? images : originalImages,
      images_count: mechanism == 'default' ? images_count : originalImages_count,
      message,
      project_id,
      options,
      status,
      status_changed_at,
      trigger,
      updated_at,
      url,
      user_id,
    }

    ctx.body = body
  } catch (error) {
    console.log('error: ', error)
    ctx.status = 500
  }
})

router.post('/download/single', async (ctx, next) => {
  const { imageId } = ctx.request.body
  console.log('imageId: ', imageId)
  let buffers = []

  if (config.matchingMechanism == 'default') {
    buffers = imageBuffers
  } else {
    buffers = originalImageBuffers
  }

  for (const item of buffers) {
    if (imageId == item.id) {
      const imageBuffer = item.imageBuffer
      const filename = item.name + '.' + item.type

      // 设置响应头，告诉浏览器这是一个图像文件
      ctx.set('Content-Type', `image/${item.type}`)
      // 设置响应头，告诉浏览器以附件形式下载图像
      ctx.set('Content-Disposition', `attachment; filename=${filename}`)
      // 将图像文件内容作为响应发送给前端
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
  let buffers = []

  if (config.matchingMechanism == 'default') {
    buffers = imageBuffers
  } else {
    buffers = originalImageBuffers
  }

  const zip = new JSZip()
  let index = 0
  for (const imageId of imageIds) {
    index++
    index = index < 10 ? `0${index}` : index

    for (const item of buffers) {
      if (imageId == item.id) {
        const imageBuffer = item.imageBuffer
        const filename = `${item.name}_${index}` + '.' + item.type
        // 将图像添加到ZIP文件中
        zip.file(filename, imageBuffer)
        break
      }
    }
  }

  // 生成 ZIP 压缩包
  const zipData = await zip.generateAsync({ type: 'nodebuffer' })

  // 包装成读取流
  const readStream = new stream.PassThrough()
  readStream.end(zipData)

  ctx.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename=${config.filename}.zip`,
  })

  ctx.body = readStream
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(SERVER_PORT, () => {
  console.log('Server started successfully')
})
