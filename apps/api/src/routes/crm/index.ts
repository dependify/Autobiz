import { Hono } from 'hono'
import { contactsRouter } from './contacts'

const router = new Hono()

router.route('/contacts', contactsRouter)

export { router as crmRouter }
