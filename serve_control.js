import { serve } from "https://deno.land/std@0.185.0/http/server.ts"
import { serveDir } from "https://deno.land/std@0.185.0/http/file_server.ts"
import { generate_name } from "./modules/generate_name.js"

const kv = await Deno.openKv (`/Users/capo_greco/Documents/deno_kv_test/test`);
// const kv = await Deno.openKv ()

let control = false

const req_handler = async incoming_req => {
   let req = incoming_req
   const path = new URL (req.url).pathname
   const upgrade = req.headers.get ("upgrade") || ""
   if (upgrade.toLowerCase () == "websocket") {
      const id = req.headers.get (`sec-websocket-key`)
      const name = generate_name ()
      const { socket, response } = Deno.upgradeWebSocket(req)
      socket.onopen = async () => {
         socket.send(JSON.stringify({
            method: `id`,
            content: { id, name }
         }))
         if (!control) {
            control = socket
            control.id = id
         }
      }
      socket.onmessage = async m => {
         const { method, content } = JSON.parse(m.data)
         const manage_method = {
            pong: async () => {
               const now = Date.now ()
               const { value } = await kv.get([ `synth`, id ])
               value.ping = (now - value.last_update) * 0.5
               console.log (`${ name }'s ping is ${ value.ping }`)
               value.last_update = Date.now ()
               await kv.set([ `synth`, id ], value)
            },
            greeting: () => console.log (msg.content),
         }
         manage_method[method]()
      }
      socket.onerror = e => console.log(`socket error: ${e.message}`)
      socket.onclose = async () => {
         if (!control) return
         if (control.id == id) {
            control = false
         }
      }

      return response
   }
   
   const options = {
      fsRoot : `control`,
      index  : `index.html`,
   }

   return serveDir (req, options)
}


serve (req_handler, { port: 8080 })
console.log (`server is running on port 8080`)

async function update_list () {
   const synths = kv.list ({ prefix : [ `synth` ]})
   const synth_array = []
   for await (const { value } of synths) {
      synth_array.push (value.name)
   }
   if (control) {
      control.send (JSON.stringify ({
         method: `list`,
         content: synth_array,
      }))
   }
}

setInterval (update_list, 200)
