const express = require("express");
const Mongo = require("mongoose");
const crypto = require("crypto");
const bodyParser = require("body-parser");
const { urlencoded } = require("body-parser");
const {check, validationResult} = require("express-validator");
const cookieParser = require('cookie-parser');
const session = require("express-session");
const internal = require("stream");


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

const Student = Mongo.Schema(

    {
        firstName: String,
        lastName: String,
        DOB: String,
        address: String,
        city: String,
        country: String

    }

);

const Lesson = Mongo.Schema(
    {
        lessonName:String,
        chapter:String,
        lessonPages: String,
        lessonDate: String,
        attendance: [String]
    }
);
const Class = Mongo.model("class", 
    {
        className: String,
        classLevel: String,
        startDate: String,
        endDate: String,
        level: String,
        userid: String,
        students: [Student],
        lessons: [Lesson]
    }
);




Website.get("/", (req,res) => {

    const sessionid =  req.cookies.SESSION_ID;
    

    User.findOne({sessionid: sessionid}).exec((err, user) => {
        
        if(err || user === null){
            
            console.log(user);
            
            res.render("login");
            
        }

        else
        {
            Class.find({userid: user._id}, (err, docs) => {
                console.log("docs: " + docs);

           
                res.render("home", {name: user.name, classes: docs});
         
    
                
            });
            
        }
    });

});

Website.get('/signup', (req, res) => {
    res.render('signup');
});

Website.get('/class/:id', (req, res) => {
    console.log(req.body.id);

    Class.findOne({_id: req.params.id}).exec((err, classDoc) => {
        console.log(classDoc);

        if (classDoc === null)
        {
            res.status('404');
        }

        else
        {
            res.render('class', classDoc);
        }
    })
    
});

//handle logout
Website.get('/logout', (req, res) =>  {
    res.cookie('SESSION_ID', '', {maxAge: 1});
    res.redirect('/');
});


//handing post requests from the signup page.
Website.post('/signup', [
    check("firstname", "must have a first name !").not().isEmpty(),
    check("lastname", "must have a last name !").not().isEmpty(),
    check("email", "must have an email !").isEmail(),
    check("password", "must have a password").not().isEmpty()
], (req,res) => {
    
    var errors = validationResult(req);
    var password = req.body.password;
    var password2 = req.body.passwordConfirm;

    //validation for same email address
    User.findOne({email: req.body.email}).exec((err, user) => {
        console.log("user: " + user);

        if (user !== null)
        {
            res.render("signup", {
                message: "Email address is already taken !"
            });
        }

        else
        {
            //validations for all signup input
            if (!errors.isEmpty())
            {
                    res.render("signup", {
                    errors:errors.array()
                });

            }

            // validation for confirming password
            if (password !== password2)
            {
                res.render("signup", {
                    message: "Passwords do not match !"
                });
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

                newUser.save().then(() => {
                    console.log('new user created');
                    res.cookie("SESSION_ID", sessionid, {httpOnly:true});
                    res.redirect("/");
                });
            }

        }
    });

    

});


// creates a session after login attempted
Website.post('/login', (req, res) => {
    console.log(req.body);

    User.findOne({email: req.body.email}).exec( (err, user) => {
        console.log("User: " + user);
        console.log("err: " + err);

        //if email doesn't match ...
        
        if (user === null)
        {
            
            res.status(404).render("login", {
                message: "Invalid email !"
            });
    
        }

        else 
        {
             //hash incoming password and salt 
            const pass = req.body.password;
            const salt = user.salt;

            const hashedInputPassword = crypto.createHmac('sha256', salt).update(pass).digest('hex');

            if (hashedInputPassword === user.password)
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

            // if password doesm't match ...
            else
            {
                res.status(404).render("login", {
                    message: "Invalid credentials !"
                });
            }

        }

    });
       
         
});


//Post request for adding a class record
Website.post("/addclass", (req, res) => {
    console.log(req.body);

    User.findOne({sessionid: req.cookies.SESSION_ID}).exec((err, user) => {
        const userid = user._id;

        console.log(userid);
        const newClass = new Class({className: req.body.className, level: req.body.level, startDate: req.body.startDate, endDate: req.body.endDate, userid: userid});
        
        newClass.save().then(() => {
            console.log("class added !");
            res.redirect('/')
        });
    });

});



//Post request for adding a student to a class

Website.post('/addstudent/:id', (req, res) => {
    const classid = req.params.id;
    const sessionid = req.cookies.SESSION_ID;

    const data = req.body;

    console.log('classid', classid);
    console.log('sessionid', sessionid)

    console.log("Data", data);

    User.findOne({sessionid: sessionid}).exec((err, user) =>{
        if(err || user === null)
        {
            console.error('this user is not authenticated');
            res.redirect('/login');
        }
        else
        {
            Class.findOne({_id: classid}).exec((err, classdoc) => {
                if(err)
                {
                    //handle error
                }

                else{

                    if(classdoc.userid == user._id)
                    {
                        classdoc.students.push(data);
                        classdoc.save().then( saveddoc => {

                                console.log('Added a new student', saveddoc);
                                res.redirect('back');
                            }).catch(err => res.send(err));
                    }
                }
            });
        }
    });

});

Website.post('/addlesson/:id', (req, res) =>{
    const classid = req.params.id;
    const sessionid = req.cookies.SESSION_ID;

    const data = req.body;

    console.log('classid', classid);
    console.log('sessionid', sessionid)

    console.log("Data", data);

    User.findOne({sessionid: sessionid}).exec((err, user) =>{
        if(err || user === null){
            console.error('this user is not authenticated');
            res.redirect('/login');
        }
        else{
            Class.findOne({_id: classid}).exec((err, classdoc) => {
                if(err){
                    //handle error
                }else{
                    if(classdoc.userid == user._id){
                        classdoc.lessons.push(data);
                        classdoc.save()
                            .then( saveddoc => {
                                console.log('Added a new student', saveddoc);
                                res.redirect('back');
                            })
                            .catch(err => res.send(err));
                    }
                }
            });
        }
    });

});

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