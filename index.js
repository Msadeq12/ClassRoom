const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const {check, validationResult} = require("express-validator");
const cookieParser = require('cookie-parser');
const session = require("express-session");
const { exec } = require("child_process");
const { stringify } = require("querystring");


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

//Login users for MongoDB
const User = Mongo.model("user",
    {
        email: String,
        password: String,
        salt: String,
        name: String,
        sessionid: String
    }
);

const Class = Mongo.model("class", 
    {
        className: String,
        classLevel: String,
        startDate: String,
        endDate: String,
        students: Array
    }
);

const Student = Mongo.model("student",

    {
        className: String,
        studentName: String,
        age: String,
        profession: String,
        nationality: String

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
            res.render("home", {name: user.name});
        }
    });

});

Website.get('/signup', (req, res) => {
    res.render('signup');
});


//handing post requests from the signup page.
Website.post('/signup', [
    check("firstname", "must have a first name !").not().isEmpty(),
    check("lastname", "must have a last name !").not().isEmpty(),
    check("email", "must have an email !").isEmail(),
    check("password", "must have a password").not().isEmpty()
], (req,res) => {
    
    var errors = validationResult(req);

    if (!errors.isEmpty())
    {
        res.render("signup", {
            errors:errors.array()
        });

        return;
    }

    else 
    {
        const name = `${req.body.firstname} ${req.body.lastname}`;
        const email = req.body.email;
        const salt = randomSalt();
        const password = req.body.password;
        const hashedandsaltedpassword = crypto.createHmac("sha256", salt).update(password).digest("hex");
        
        //creates the 1st session ID
        const sessionid = randomString();

        const newUser = new User({email: email, password: hashedandsaltedpassword, salt: salt, name: name, sessionid: sessionid});

        newUser.save().then(() =>{
            console.log('new user created');
            res.cookie("SESSION_ID", sessionid, {httpOnly:true});
            res.redirect("/");
        });
    }

});


// creates a session after login attempted
Website.post('/login', (req, res) => {
    console.log(req.body);
    User.findOne({email: req.body.email}).exec( (err, user) => {
        console.log(user);

        //hash incoming password and salt 
        const pass = req.body.password;
        const salt = user.salt;

        const hashedInputPassword = crypto.createHmac('sha256', salt).update(pass).digest('hex');
        
        if(hashedInputPassword === user.password)
        {
            console.log("auth successful");

            //generates the 2nd session ID
            const sessionid = randomString();

            //MongoDB updates the session ID here:
            User.updateOne({email: user.email}, {$set: {"sessionid": sessionid}}).exec((cb)=>{
                console.log(cb);
            });
            

            res.cookie("SESSION_ID", sessionid, {httpOnly:true});
            res.redirect('/');
        }

    });
});

//Post request for adding a class record
Website.post("/addclass", (req, res) => {

    const newClass = new Class()

})

Website.listen(1550, () => {
    console.log("Listening at 1550...");
});

//this function generates a random string which is the session id for a partcular user.
function randomString (){
    return crypto.randomBytes(32).toString('hex');
}

//this function generates a random string for the salted passwords.
function randomSalt () {
    return crypto.randomBytes(16).toString("hex");
}