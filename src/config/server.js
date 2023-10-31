import dotenv from 'dotenv'

dotenv.config()

const { SERVER_PORT, SERVER_HOST } = process.env

export { SERVER_PORT, SERVER_HOST }
