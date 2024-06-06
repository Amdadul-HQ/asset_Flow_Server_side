require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SK_KEY);
const cors = require("cors");
const port = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster12.5dhxjyi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster12`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    const usersCollection = client.db("assetFlow").collection("users");
    const assetsCollection = client.db("assetFlow").collection("assets");
    const companyCollection = client.db("assetFlow").collection("company");
    const requestAssetCollection = client.db("assetFlow").collection("requestedAsset");
    const monthlyAssetRequestCollection = client.db("assetFlow").collection("monthlyAssetRequest");
    const paymentsCollection = client.db("assetFlow").collection("payments");
    
    const verifyToken = (req,res,next) => {
      console.log('inside verifyToken',req.headers);
      if(!req.headers.authorization){
        res.status(403).send({message:'Forbidden Access'})
      }
      const token = req.headers.authorization.split(' ')[1]
      console.log('inside veryfiy token barear',token);
      jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(error,decode)=>{
        if(error){
          return res.status(403).send({message:'Forbidden Access'})
        }
        req.decode = decode
        next()
      })
    }
    // jwt
    app.post('/jwt',async(req,res)=>{
      const userInfo = req.body
      const token = jwt.sign(userInfo,process.env.ACCESS_TOKEN_SECRET,{expiresIn:'1h'})
      res.send({token})
    })
    // save payment data
    app.post('/payments',async(req,res)=>{
      const paymentDetails = req.body;
      const email = paymentDetails.email
      const packageName = paymentDetails.name
      const query = {
        email:email
      }
      const updataDoc = {
        $set:{
          packageName
        }
      }
      const result = await usersCollection.updateOne(query,updataDoc)
      res.send(result)
    })
    // package 
    app.get('/package/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        email:email
      }
      const hrdetails = await usersCollection.findOne(query)
      const package = hrdetails?.packageName
      res.send(package)
    })




    app.post("/create-payment-intent", async (req, res) => {
      const price = req.body.price;
      const priecInCent = parseFloat(price * 100)
      if(!price || priecInCent < 1){
        return
      }
      // Generate client secret
      const {client_secret} = await stripe.paymentIntents.create({
        amount: priecInCent,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });
      // send a client secret in response
      res.send({clientSecret : client_secret})
    });


    // post on requested Asset
    app.post('/requestasset',async(req,res)=>{
      const requestAsset = req.body;
      const id = requestAsset.key;
      const query = {
        _id:new ObjectId(id)
      }
      const updataDoc = {
        $inc:{requestCount:1}
      }
      const updateMainCollection = await assetsCollection.updateOne(query,updataDoc)
      const requestAssetOnly = await monthlyAssetRequestCollection.insertOne(requestAsset)
      const result = await requestAssetCollection.insertOne(requestAsset)
      res.send(result)
    })
    // only month request asset
    app.get('/monthrequestasset/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        email:email,
        requestMonth:new Date().getMonth(),
        requestYear:new Date().getFullYear(),
      }
      const result = await monthlyAssetRequestCollection.find(query).toArray()
      res.send(result)
    })

    // geting requested asset 
    app.get('/requestedasset/:email',async(req,res)=>{
      const email = req.params.email;
      const search = req.query.search;
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page);
      let query = {}
      if(search){
        query = {
          'assetHolder.email':email,
          status:'Requested',
          email:{$regex:search , $options:'i'},
        }
        const result = await requestAssetCollection.find(query).toArray()
        return res.send(result) 
      }
      else{
        query = {
          'assetHolder.email':email,
          status:'Requested',
        }
        const result = await requestAssetCollection.find(query).skip(size * page).limit(size).toArray()
        res.send(result)
      }
    })
    // requested count
    app.get('/requestedcount/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        'assetHolder.email':email,
        status:'Requested',
      }
      const count = await requestAssetCollection.countDocuments(query)
      res.send({count})
    })

    // geting pending request as employee
    app.get('/pendingasset/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        email:email,
        status:'Requested',
      }
      const result = await requestAssetCollection.find(query).toArray()
      res.send(result)
    })

    // geting asset for the employee
    app.get('/assetsofemploye/:email',async(req,res)=>{
      const search = req.query.search
      const email = req.params.email;
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page) ;
      let query = {}
      
      if(search){
        query = {
          email:email,
          productName:{$regex:search , $options:'i'},
        }
        const result = await requestAssetCollection.find(query).toArray()
        return res.send(result)
      }
      else{
        query = { 
          email:email
        }
        const result = await requestAssetCollection.find(query).skip(size * page).limit(size).toArray()
        res.send(result)
      }
    })
    app.get('/myteamembercount/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        hremail:email
      }
      const count = await companyCollection.countDocuments(query)
      res.send({count})
    })
  

    // deleting asset as employee
    app.delete('/assetsofemploye/:id',async(req,res)=>{
      const id = req.params.id
      const query = {
        _id: new ObjectId(id)
      }
      const result = await requestAssetCollection.deleteOne(query)
      res.send(result)
    })

    // Return Asset
    app.patch('/returnupdate/:key',async(req,res)=>{
      const key = req.params.key;
      const id = req.body.id
      console.log('key=>',key,'id=>',id);
      const filter = {
        _id:new ObjectId(key)
      }
      const query = {
        _id: new ObjectId(id)
      }
      const updataDoc = {
        $inc: { productQuantity: 1 ,
         }
      }
      const updataMainAsset = await assetsCollection.updateOne(filter,updataDoc)
      const result = await requestAssetCollection.deleteOne(query)
      res.send({result,updataMainAsset})
    })

    // accept asset request as hr
    app.patch('/acceptasset/:key',async(req,res)=>{
      const id = req.params.key;
      const secid = req.body.id;
      const query = {
        _id:new ObjectId(id)
      }
      const filter = {
        _id : new ObjectId(secid)
      }
      const updataDoc = {
        $set:{
          status:'Approve',
          approvalDate: new Date()
        },
        $inc: { productQuantity: -1 }
      }
      const updateForMainAsset = {
        $inc: { productQuantity: -1,
          requestCount: -1
         }
      }
      const resultMainAsset = await assetsCollection.updateOne(query,updateForMainAsset)
        const result = await requestAssetCollection.updateOne(filter,updataDoc)
      res.send(result)
    })
   
    // Reject reuest as hr
    app.patch('/rejectasset/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {
        _id:id
      }
      const updataDoc = {
        $set:{
          status:'Rejected',
        }
      }
      const result = await requestAssetCollection.updateOne(query,updataDoc)
      res.send(result)
    })

    // updatarequestCount api
    app.patch('/updaterequestcount/:key',async(req,res)=>{
      const id = req.params.key;
      const query = {
        _id : new ObjectId(id)
      }
      const updateDoc = {
        $inc:{ requestCount: -1 }
      }
      const result = await assetsCollection.updateOne(query,updateDoc)
      res.send(result)
    })

 

    // post a user into a company
    app.post('/addtocompany',async(req,res)=>{
      const employeeDetails = req.body
      const id = employeeDetails?._id;
      const hremail = employeeDetails?.hremail;
      const companyName = employeeDetails?.companyName;
      const companyLogoUrl = employeeDetails?.companyLogoUrl
      const filter = {
        email:hremail
      }
      const query = {
        _id: ObjectId.createFromHexString(id),
      };
      const updateEmployee = {
        $set:{
          role:'employee',
          status:'in Job',
          hremail:hremail,
          companyName:companyName,
          companyLogoUrl:companyLogoUrl
        }
      }
      const updateHr = {
        $inc:{teamMember:1}
      }
      const updateHrProfile = await usersCollection.updateOne(filter,updateHr)
      const updateUser = await usersCollection.updateOne(query,updateEmployee)
      const result = await companyCollection.insertOne(employeeDetails)
      res.send({result,updateUser})
    })
    // company emplyeee APi
    app.get('/companyemployee/:email',async(req,res)=>{
      const email = req.params.email;
      const size = parseInt(req.query.size);
      const page = parseInt(req.query.page);
      const query = {
        hremail:email,
      }
      const result = await companyCollection.find(query).skip(page * size).limit(size).toArray()
      res.send(result)
    })
    // company employee count
    app.get('/companyemployeecount/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        hremail:email
      }
      const count = await companyCollection.countDocuments(query)
      res.send({count})
    })

    //remove from company 
    app.delete('/employee/:id',async(req,res)=>{
      const id = req.params.id
      console.log(req.body);
      const filter = {
       _id : new ObjectId(id)
      }
      const query ={
        _id: id
      }
      const updateDoc = {
        $set:{
          role:'user',
          status:'Available',
        },
      }

      const user = await usersCollection.updateOne(filter,updateDoc)
      const result = await companyCollection.deleteOne(query)
      res.send({result})
    })
    app.patch('/updateteamcount/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        email:email
      }
      const updateDoc = {
        $inc:{teamMember:-1}
      }
      const result = await usersCollection.updateOne(query,updateDoc)
      res.send(result)
    })

    // pic chart api
    app.get('/returnable-nonreturnable/:email',async(req,res)=>{
      const email = req.params.email
      const result = await monthlyAssetRequestCollection.aggregate([{
        $match:{
          'assetHolder.email': email
        }
      },
      {
        $unwind:'$requestDate'
      },
        {
          $group:{
            _id:"$productType",
            count:{$sum:1}
          }
        }
      ]).toArray()
      res.send(result)
    })

    // get a user single data 
    app.get('/userdetails/:email',async(req,res)=>{
      const email = req.params.email;
      const query ={
        email:email
      }
      const result = await usersCollection.findOne(query)
      res.send(result)
    })

    // save an asset in database
    app.post('/addasset',async(req,res)=> {
      const asset = req.body;
      const result = await assetsCollection.insertOne(asset)
      res.send(result)
    })
    // get assets from database
    app.get('/assets/:email',async(req,res)=>{
      const email = req.params.email;
      const search = req.query.search;
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      let query = {}
      
      if(search){
        query = {
          "assetHolder.email":email,
          productName:{$regex:search , $options:'i'},
        }
        const result = await assetsCollection.find(query).toArray()
        return res.send(result)
      }
      query = {
        "assetHolder.email":email
      }
      const result = await assetsCollection.find(query).skip(page * size).limit(size).toArray()
      res.send(result)
    })
    // asset count
    app.get('/assetcount/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        'assetHolder.email':email
      }
      const count = await assetsCollection.countDocuments(query)
      res.send({count})
    })
    // asset delete 
    app.delete('/asset/:id',async(req,res)=> {
      const id = req.params.id;
      console.log(id);
      const query = {
        _id: new ObjectId(id),
      };
      const result = await assetsCollection.deleteOne(query)
      res.send(result)
    })
    // update asset api
    app.get('/asset/:id',async(req,res)=> {
      const id = req.params.id
      const query = {
        _id: new ObjectId(id),
      };
      const result = await assetsCollection.findOne(query)
      res.send(result)
    })
    app.patch('/updateasset/:id',async(req,res)=>{
      const id = req.params.id
      const query = {
        _id : new ObjectId(id)
      }
      const updateAsset = req.body
      const updateDoc= {
        $set:{
          ...updateAsset
        }
      }
      const result = await assetsCollection.updateOne(query,updateDoc)
      res.send(result)
    })
    // geting normal user
    app.get('/users',async(req,res)=>{
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const query = {
        role:'user'
      }
      const result = await usersCollection.find(query).skip(page * size).limit(size).toArray()
      res.send(result)
    })
    // normal user count
    app.get('/userscount',async(req,res)=>{
      const query = {
        role:'user'
      }
      const count = await usersCollection.countDocuments(query)
      res.send({count})
    })

    // logout 
    // app.get("/logout", async (req, res) => {
    //     try {
    //       res
    //         .clearCookie("token", {
    //           maxAge: 0,
    //           secure: process.env.NODE_ENV === "production",
    //           sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //         })
    //         .send({ success: true });
    //     } catch (err) {
    //       res.status(500).send(err);
    //     }
    //   });

    // save a hr in data base
    // app.put('/hrmanager',async(req,res)=> {
    //   const hr = req.body;
    //   const option = {upsert:true};
    //   const query = {
    //     email:hr?.email
    //   }
    //   const isExist = await hrCollection.findOne(query)
    //   if(isExist){
    //     return isExist
    //   }
    //   else{
    //     const result = await hrCollection.insertOne(hr)
    //     res.send(result)
    //   }
    // })

    // hr get
    app.get('/hrmanager/:email',async(req,res)=>{
      const email = req.params.email;
      // if(email !== req.decode.email){
      //   return res.status(403).send({message:'Unauthorized Access'})
      // }
      const query = {
        email:email
      }
      const hr = await usersCollection.findOne(query)
      let hrRole = false
      let employeeRole = false
      if(hr){
        hrRole = hr?.role === 'hr'
        employeeRole = hr?.role === 'employee'
      }
      res.send({hrRole,employeeRole})
    })

    // save a user in data base
    app.put("/user", async (req, res) => {
      const user = req.body;
      const option = { upsert: true };
      const query = {
        email: user?.email,
      };
      // Checking isExeist
      const isExist = await usersCollection.findOne(query);
      if(isExist){
        return isExist
      }
      else{
        const result = await usersCollection.insertOne(user)
        res.send(result)
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.use("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
