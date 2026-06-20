import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './Auth'

const app = new Hono()

// Basic CORS setup for Vite frontend
app.use('*', cors({
    origin: ['http://localhost:5173', 'https://irms.vercel.app'],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}))

// Mount Better-Auth
app.on(['POST', 'GET'], '/api/auth/**', (c) => {
    return auth.handler(c.req.raw)
})

app.get('/', (c) => {
    return c.text('IRMS Auth Server running on Hono.')
})

export default app
