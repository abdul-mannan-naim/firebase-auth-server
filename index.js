const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors())
app.use(express.json())

const uri = process.env.MONGODB_URI
// const uri = "mongodb+srv://eShop:eShop@cluster0.fgwma2r.mongodb.net/?retryWrites=true&w=majority"
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
    const doctorsCollection = await client.db('eShop').collection('doctors')
    const adminsCollection = await client.db('eShop').collection('admins')
    const commentsCollection = await client.db('eShop').collection('comments')
    const paymentsCollection = await client.db('eShop').collection('payments')

    // ---------------------------------------------------------------------
    // -------------only admin control this -------------------------------- 
    // ---------Our product post get update and delete way ----------------- 
    // --------------------------------------------------------------------- 
    app.post('/product', async (req, res) => {
      const query = req.body;
      const result = await productsCollection.insertOne(query)
      res.send(result)
    })
    app.put('/update/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const query = req.body;
      const requester = req.decoded.email;
      if (requester) {
        const filter = { _id: ObjectId(id) }
        const options = { upsert: true };
        const doc = {
          $set: query
        }
        const result = await productsCollection.updateOne(filter, doc, options)
        res.send(result)
      }
    })
    app.delete('/delete/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const filter = { _id: ObjectId(id) }
      const result = await productsCollection.deleteOne(filter);
      res.send(result)
    })
    app.get('/getProduct', verifyJWT, async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).toArray()
      res.send(result)
    })
    app.get('/productName', async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).project({ name: 1 }).toArray()
      res.send(result)
    })
    app.get('/getproductbysearch', verifyJWT, async (req, res) => {
      const query = {};
      const result = await productsCollection.find(query).toArray()
      res.send(result)
    })
    // -------------------------comment post---------------------------------
    app.post('/comment', async (req, res) => {
      const query = req.body;
      const result = await commentsCollection.insertOne(query)
      res.send(result)
    })
    // ---------------------------get comment for specific product----------- 
    app.get('/comment/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { productId: id }
      const result = await commentsCollection.find(filter).toArray()
      res.send(result)
    })
    // -----------------------delete comment--------------------------------- 
    app.delete('/comment/:id', async (req, res) => {
      const id = req.params;
      const filter = { _id: ObjectId(id) }
      const result = await commentsCollection.deleteOne(filter)
      res.send(result)
    })
    //  ------------check commenter by email id or find commenter by email id--------------  
    app.get('/commenter/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const requester = req.decoded.email;
      const filter = { _id: ObjectId(id) }
      const specificComment = await commentsCollection.findOne(filter)
      const { messagerEmail } = specificComment
      if (messagerEmail === requester) {
        res.send({ success: true, message: "It's You" })
      }
      else {
        res.send({ success: false, message: "You are not Authorized" })
      }
    })
    // -------------------------------rating--------------------------- 
    app.put('/rating/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const requester = req.decoded.email;
      const { ratin } = req.body;
      const user = {
        rating: ratin,
        rater: requester,
      }
      const filter = { _id: ObjectId(id) }
      // ------------------------destructure array of a object--------------------------
      //  const raterRating =await productsCollection.findOne(filter)
      // const {rating:[{rater}]} =raterRating;
      // console.log(rater)
      // if(rater){
      //   return res.status(403).send({ success:false, message: " You already rated " })
      // }
      // --------------------------------------------------------------------------------
      const specificProduct = await productsCollection.findOne(filter)
      const { rating } = specificProduct
      // console.log(rating); 
      // rating.forEach((admin)=> {
      //   console.log(` ${admin.rating} ${admin.rater} `)
      // }) 
      const specificRater = await rating.filter(item => item.rater === requester).length
      const options = { upsert: true };
      if (specificRater < 1) {
        const doc = {
          $push: {
            rating: {
              $each: [user],
              $position: 0
            }
          }
        }
        const result = await productsCollection.updateOne(filter, doc, options)
        return res.send({ success: true, result })
      }

      else if (specificRater > 0) {
        return res.send({ success: false, message: "You Already Rated" })
      }
    })
    // -------------------------check rater by email id or find rater by email id-------------------------------------------
    app.get('/rating/:id', verifyJWT, async (req, res) => {
      const id = req.params;
      const requester = req.decoded.email;
      const filter = { _id: ObjectId(id) }
      const specificProduct = await productsCollection.findOne(filter)
      const { rating } = specificProduct
      const specificRater = await rating.find(item => item.rater === requester)
      res.send(specificRater)
    })
    //  ------------------------------------------------------------ 
    // ------------------a customer can orders our products--------- 
    // -------------------------------------------------------------
    app.post('/order', verifyJWT, async (req, res) => {
      const query = req.body;
      const result = await ordersCollection.insertOne(query)
      res.send(result)
    })

    // --------------customer wants to payment------
    app.post('/create-payment-intent', async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      })
      res.send({ clientSecret: paymentIntent.client_secret })
    })
    // -----------a specific customer can see his/her orders-------- 
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
    // ------------------------------------------------
    // -------------------useParams--------------------
    // -------------------(practice)------------------- 
    // ------------------------------------------------//  
    app.get('/myOrder/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await ordersCollection.findOne(query)
      res.send(result)
    })

    // ------------------------update a order after payment-----------------------------
    app.patch('/order/:id', async (req, res) => {
      const id = req.params.id;
      const payment=req.body;
      const filter ={_id:ObjectId(id)}
      const updateDoc ={
        $set:{
          paid:true,
          transactionId:payment.transactionId,
        }
      } 
      const result =await paymentsCollection.insertOne(payment)
      const updateOrder =await ordersCollection.updateOne(filter,updateDoc)
      res.send(updateDoc)
    })

    // ----------------------------------------------------------------------------------------------

    app.get('/users', verifyJWT, async (req, res) => {
      const user = await usersCollection.find().toArray()
      res.send(user)
    })
    app.get('/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = await usersCollection.findOne({ email: email })
      const isAdmin = query.role === "admin"
      res.send({ admin: isAdmin })
    })
    // etar jonno verifyJWT kora jabena, tahole token undefined hoye jabe
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
    // -------------------make a user as a admin------------------------
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const admin = req.body;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({ email: requester })
      if (requesterAccount.role === "admin") {
        const filter = { email: email }
        const options = { upsert: true }
        const updateDoc = {
          $set: admin
        }
        const doc = {
          $set: { role: "admin" },
        }
        const userResult = await usersCollection.updateOne(filter, doc, options)
        const adminResult = await adminsCollection.updateOne(filter, updateDoc, options)
        res.send({ userResult, adminResult })
      }
      else {
        res.status(403).send({ message: " UnAuthorized to make admin " })
      }
    })
    // ----------------make a user as a doctor-----------------
    app.put('/doctors/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const doctor = req.body;
      const requester = req.decoded.email;
      const requesterAccount = await usersCollection.findOne({ email: requester })
      if (requesterAccount.role === "admin") {
        const filter = { email: email }
        const option = { upsert: true }
        const doc = {
          $set: { profession: "doctor" }
        }
        const updateDoc = {
          $set: doctor
        }
        const userResult = await usersCollection.updateOne(filter, doc)
        const doctorResult = await doctorsCollection.updateOne(filter, updateDoc, option)
        res.send({ userResult, doctorResult })
      }
    })



    // ------------------------------------------------
    // -------------------useParams--------------------
    // -------------------(practice)------------------- 
    // ------------------------------------------------//  
    app.get('/booking/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await usersCollection.findOne(query)
      res.send(result)
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









