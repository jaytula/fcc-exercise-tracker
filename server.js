const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
const isValid = mongoose.Types.ObjectId.isValid
const ObjectID = require('mongodb').ObjectID

mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track', {useNewUrlParser: true, useCreateIndex: true,
} )

let exerciseSchema = new mongoose.Schema({
  description: {type: String, required: true},
  duration: {type: Number, required: true},
  date: {type: Date, required: true}
})

let userSchema = new mongoose.Schema({
  username: {type: String, unique: true, required: true},
  exercises: {type: [exerciseSchema]}
})

let User = mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', async (req, res) => {  
  try {
    if(!req.body.username) throw new Error('username is not present')
    let newUser = new User({username: req.body.username})
    let result = await newUser.save()
    res.json(result)
  } catch(err) {
    console.error(err)
    res.send(err.message, 400)
  }
})

app.get('/api/exercise/users', async (req, res) => {
  try {
    let users = await User.find({}).select('-exercises')
    res.json(users)
  } catch(err) {
    res.status(400).send(err.message)
  }    
})

app.post('/api/exercise/add', async (req, res) => {
  try {
    let {userId: username, description, duration, date} = req.body
    date = date ? new Date(date) : new Date()
    
    let objectIdCheck = isValid(username) ? [{_id: ObjectID(username)}] : []
    let user = await User.findOne({$or: [{username: username}, ...objectIdCheck]}).exec()
    // give me a sec
    if(!user) throw new Error('username invalid') 
    user.exercises.push({description, duration, date})
    let result = await user.save()
    res.json(result)
  } catch(err) {
      res.status(400).send(err.message)
  }
})

app.get('/api/exercise/log/:userid', async (req, res) => {
  try {
    let {userid} = req.params
    let {from, to, limit} = req.query
    
    let objectIdCheck = isValid(userid) ? [{_id: ObjectID(userid)}] : []

    let user = await User.findOne({$or: [{username: userid}, ...objectIdCheck]}).lean().exec()
    if(!user) throw new Error('username invalid')
    
    let exercises = user.exercises
    if(from) exercises = exercises.filter(e => new Date(e.date) >= new Date(from))
    if(to) exercises = exercises.filter(e => new Date(e.date) <= new Date(to))
    if(limit) exercises = exercises.slice(0, limit)
    
    user.log = exercises
    user.count = exercises.length
    delete user.exercises
    
    res.json(user)
  } catch(err) {
    res.status(400).send(err.message)
  }
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
