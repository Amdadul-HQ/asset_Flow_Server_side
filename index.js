require("dotenv").config();
const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 5000;
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
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

    // save an asset in database
    app.post('/addasset',async(req,res)=> {
      const asset = req.body;
      const result = await assetsCollection.insertOne(asset)
      res.send(result)
    })
    // get assets from database
    app.get('/assets/:email',async(req,res)=>{
      const email = req.params.email;
      const query = {
        "assetHolder.email":email
      } 
      const result = await assetsCollection.find(query).toArray()
      res.send(result)
    })
    // asset delete 
    app.delete('/asset/:id',async(req,res)=> {
      const id = req.params.id
      const query = {
        _id :new ObjectId(id)
      }
      const result = await assetsCollection.deleteOne(query)
      res.send(result)
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
