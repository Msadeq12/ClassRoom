const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const cookieParser = require('cookie-parser');
const session = require("express-session");
const { exec } = require("child_process");


const Website = express();
Website.use(bodyParser.urlencoded({extended: false}));
Website.use(cookieParser());
Website.use(express.static("public"));

Website.set("views", "pages");
Website.set("view engine", "ejs");

Mongo.connect("mongodb://localhost:27017/ClassRoom",
    {useNewUrlParser: true},
    () => console.log("connected to ClassRoom DB...")
);

const User = Mongo.model("user",
    {
        email: String,
        password: String,
        name: String,
        sessionid: String
    }
);

Website.get("/", (req,res) => {

    const sessionid =  req.cookies.SESSION_ID;
    

    User.findOne({sessionid: sessionid}).exec((err, user) => {
        if(err || user === null){
            res.render('login');
            console.log(user);
        }
        else{
            res.render("home");
        }
    });

});

Website.get('/signup', (req, res) => {
    
    res.render('signup');
});

//handing post requests
Website.post('/signup', (req, res) => {
    console.log(req.body);
    const name = `${req.body.firstname} ${req.body.lastname}`;
    const email = req.body.email;
    const password = req.body.password;

    const sessionid = randomString();

    const newUser = new User({email: email, password: password, email: email, sessionid: sessionid});

    newUser.save().then(() =>{
        console.log('new thing created');
        res.cookie("SESSION_ID", sessionid, {httpOnly:true});
    });

    //Check if credentials are correct and then redirect to home
});

Website.post('/login', (req, res) => {
    console.log(req.body);
    User.findOne({email: req.body.email}).exec( (err, user) => {
        console.log(user);

        if(req.body.password === user.password){
            console.log("auth successful");
            const sessionid = randomString();
            User.updateOne({email: user.email}, {$set: {"sessionid": sessionid}}).exec((cb)=>{
                console.log(cb);
            });
            

            res.cookie("SESSION_ID", sessionid, {httpOnly:true});
            res.redirect('/');
        }

    });
});

Website.listen(1550, () => {
    console.log("Listening at 1550...");
});

function randomString (){
    return crypto.randomBytes(32).toString('hex');
}