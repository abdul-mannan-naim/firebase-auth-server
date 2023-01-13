const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors())
app.use(express.json())

const uri = "mongodb+srv://eShop:eShop@cluster0.fgwma2r.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

    if (err) {
      return res.status(403).send({ message: "Forbidden Access" })
    }
    req.decoded = decoded;
    next()
  });
}


async function run() {

  try {
    await client.connect()
    const productsCollection = await client.db('eShop').collection('products')
    const ordersCollection = await client.db('eShop').collection('orders')
    const usersCollection = await client.db('eShop').collection('users')

    app.post('/product', async (req, res) => {
      const query = req.body;
      const result = await productsCollection.insertOne(query)
      res.send(result)
    })
    app.get('/getProduct', async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).toArray()
      res.send(result)

    })

    app.put('/update/:id', async (req, res) => {
      const id = req.params;
      const query = req.body;
      const filter = { _id: ObjectId(id) }
      const options = { upsert: true };
      const doc = {
        $set: query
      }
      const result = await productsCollection.updateOne(filter, doc, options)
      res.send(result)
    })
    app.delete('/delete/:id', async (req, res) => {
      const id = req.params;
      const filter = { _id: ObjectId(id) }
      const result = await productsCollection.deleteOne(filter);
      res.send(result)
    })

    // app.get('/available', async (req, res) => {
    //   const name = req.query.name;
    //   const query = { name: name }
    //   const products = await productsCollection.find().toArray();
    //   const orders = await ordersCollection.find(query).toArray()
    //   products.forEach(product => {

    //     const productOrders = orders.filter(book.name === product.name)
    //     const orderedQuantity = productOrders.filter(book => book.quantity)


    //   })
    //   res.send({ products, orders })

    // })

    app.post('/order', async (req, res) => {
      const query = req.body;
      const result = await ordersCollection.insertOne(query)
      res.send(result)
    })
    // -------------------- 
    
    app.get('/users', verifyJWT, async (req, res) => {
      const user = await usersCollection.find().toArray()
      res.send(user)
    })

    app.get('/myOrders', verifyJWT, async (req, res) => {

      const user = req.query.user;
      // const authorization =req.headers.authorization;
      // console.log(authorization)
      const decodedEmail = req.decoded.email;
      if (user === decodedEmail) {
        const query = { user: user }
        const bookings = await ordersCollection.find(query).toArray()
        res.send(bookings)
      }
      else {
        return res.status(403).send({ message: "forbidden access" })
      }
    })

    app.get('/admin/:email',async(req,res)=>{
      const email =req.params.email;
      const query =await usersCollection.findOne({email:email})
      const isAdmin =query.role === "admin"
      res.send({admin:isAdmin})
    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email }
      const options = { upsert: true }
      const doc = {
        $set: user,
      }
      const result = await usersCollection.updateOne(filter, doc, options)
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ result, token })

    })
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({ email: requester })
      if (requesterAccount.role === "admin") {
        const filter = { email: email }
        const doc = {
          $set: { role: "admin" },
        }
        const result = await usersCollection.updateOne(filter, doc)

        res.send(result)
      }
      else {
        res.status(403).send({ message: " UnAuthorized to make admin " })
      }

    })



  }
  finally {


  }


}

run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello World! 666666666 ggggggggggg')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})









