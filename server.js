const express = require('express')
const app = express()
const { MongoClient, ObjectId } = require('mongodb')
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const mongostore = require('connect-mongo')
const cors = require('cors')
//cors 미들웨어 추가
app.use(cors({ 
  origin(origin, callback) {
    //원래는 origin check를 해야함
    callback(null, true)
  },
  credentials : true 
}));
// 추가: body-parser middleware 사용 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'itismyserversecretcode',
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 60 * 60 * 24 * 1000},
  store : mongostore.create({
    mongoUrl : 'mongodb+srv://urous3814:RSVTFWuEP1AroGWV@ubsp-cluster.j5r463a.mongodb.net/?retryWrites=true&w=majority',
    dbName : 'UserData'
  })
}))


app.use(passport.initialize());
app.use(passport.session()) 

passport.use(new LocalStrategy(async (uid, upw, cb) => {
  let result = await db.collection('LoginData').findOne({ username : uid})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }
  if (await bcrypt.compare(upw, result.password)) {
    
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

passport.serializeUser((user, done) => {
  console.log(user)
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async(user, done) => {
  let result = await db.collection('LoginData').findOne({_id : new ObjectId(user.id)})
  delete result.password
  process.nextTick(() => {
    return done(null, result)
  })
})


let db
const url = 'mongodb+srv://urous3814:RSVTFWuEP1AroGWV@ubsp-cluster.j5r463a.mongodb.net/?retryWrites=true&w=majority'
new MongoClient(url).connect().then((client)=>{
    console.log('DB연결성공')
    db = client.db('UserData')
  
    app.listen(8081, () => {
      console.log('http://localhost:8081 에서 서버 실행중')
    })
  
  }).catch((err)=>{
    console.log(err)
  })

app.get('/', (요청, 응답) => {
  응답.send('반갑다')
}) 

// Nodemailer 설정
const smtpTransport = nodemailer.createTransport({
  pool : true,
  maxConnections: 1,
  host: "smtp.naver.com",
  port: 587,
  requireTLS: true,
  service: 'naver',
  auth: {
    user: 'anon10347@naver.com',
    pass: 'anonoffice'
  },
  tls : {
    rejectUnauthorized: false
  }
});

// 랜덤 인증 코드 생성
function generateRandomNumber() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

app.post('/verify-email', (req, res) => {
  const number = generateRandomNumber();
  const email = req.body.email; // Use the email from the request body

  const expireTime = new Date();
  expireTime.setMinutes(expireTime.getMinutes() + 3);

  const mailOptions = {
    from: 'anon10347@naver.com',
    to: email,
    subject: '인증 관련 메일 입니다.',
    html: `<h1>인증번호를 입력해주세요 \n\n\n\n\n\n</h1>${number}`,
  };

  db.collection('EmailVerifyCodes').insertOne({
    email: email,
    code: number,
    expireTime: expireTime.toISOString(),
  })
    .then(() => {m
      smtpTransport.sendMail(mailOptions, (err, info) => {
        if (err) {
          console.error('메일 전송 오류:', err);
          res.json({ ok: false, msg: '메일 전송에 실패하였습니다.' });
          smtpTransport.close();
          return;
        }

        console.log('메일 전송 성공:', info);
        res.json({ ok: true, msg: '메일 전송에 성공하였습니다.', authNum: number });
        smtpTransport.close();

      });
    })
    .catch((err) => {
      console.error('MongoDB 저장 오류:', err);
      res.json({ ok: false, msg: '인증 코드 저장에 실패하였습니다.' });
    });
});

app.post('/verify-email-check', (req, res) => {
  const { email, verificationCode } = req.body;
  console.log(verificationCode)
  // Retrieve the saved verification code and expiration time from MongoDB
  db.collection('EmailVerifyCodes')
    .findOne({
      email: email,
      code: verificationCode,
    })
    .then((result) => {
      console.log(result)
      if (result && result.expireTime >= new Date().toISOString()) {
        // Verification successful
        res.json({ ok: true, msg: '인증이 완료되었습니다.' });

        // Optionally, perform additional actions (e.g., complete user signup, mark email as verified)
      } else {
        // Verification failed
        res.json({ ok: false, msg: '인증이 실패하였습니다.' });
      }
    })
    .catch((error) => {
      console.error('MongoDB 조회 오류:', error);
      res.json({ ok: false, msg: '인증 조회 중 오류가 발생하였습니다.' });
    });
});


app.post('/user-register', async(req, res) => {
  const { username, email, password } = req.body;

  // Perform any validation checks on the received data if needed
  let hashPassword = await bcrypt.hash(password, 10)
  // Check if the email is already registered
  db.collection('LoginData').findOne({ email: email })
    .then((existingUser) => {
      if (existingUser) {
        // Email is already registered
        res.json({ ok: false, msg: '이미 등록된 이메일입니다.' });
      } else {
        // Email is not registered, proceed with registration
        // You might want to hash the password before saving it to the database for security reasons
        // Here, we assume you have a function called hashPassword for hashing the password


        // Save the user data to MongoDB
        db.collection('LoginData').insertOne({
          username: username,
          email: email,
          password: hashPassword,
        })
          .then(() => {
            // Registration successful
            res.json({ ok: true, msg: '회원가입이 완료되었습니다.' });
          })
          .catch((err) => {
            console.error('MongoDB 저장 오류:', err);
            res.json({ ok: false, msg: '회원가입에 실패하였습니다.' });
          });
      }
    })
    .catch((error) => {
      console.error('MongoDB 조회 오류:', error);
      res.json({ ok: false, msg: '회원가입 중 오류가 발생하였습니다.' });
    });
});

app.post('/user-login', async (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) {
      return res.json({ ok: false, msg: '에러가 발생했습니다.' });
    }
    if (!user) {
      return res.json({ ok: false, msg: info.message });
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.json({ ok: true, msg: '로그인에 성공했습니다.' });
    });
  })(req, res, next);
});

app.post('/logout', (req, res, next) => {
  //session 제거
  req.logout();
  return res.json({ ok: true, msg: '로그아웃에 성공했습니다.' });
  
});

app.get('/loginuser', (req, res, next) => {
  //현재 로그인 유저 
  console.log(req.user)
  res.json({ user: req.user });
});

