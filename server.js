const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const User = require('./modules/User');
const Post = require('./modules/Post');
const authMiddleware = require('./modules/authMiddleware'); 


const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));



  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });



const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } 
    );
};


const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            email: user.email,
        },
        process.env.REFRESH_TOKEN_SECRET
    );
};


app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: 'User already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);


        res.status(200).json({
            success: true,
            data: {
                userId: newUser.id,
                email: newUser.email,
                token: accessToken,
                refreshToken: refreshToken,
            },
            msg: 'User registered successfully'
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post("/login", async (req, res, next) => {
    const { email, password } = req.body;

    try {
        
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        
        const isPasswordValid = await bcrypt.compare(password, existingUser.password);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

      
        const token = jwt.sign(
            {
                userId: existingUser.id,
                username: existingUser.username,
                email: existingUser.email
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.status(200).json({
            success: true,
            data: {
                userId: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                token: token,
            },
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});



app.post('/token', async (req, res) => {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ msg: 'Refresh token is required' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }



        const accessToken = generateAccessToken(user);
        res.json({ success: true, token: accessToken });
    } catch (err) {
        console.error(err.message);
        res.status(403).json({ msg: 'Invalid refresh token' });
    }
});


app.get('/accessResource', authMiddleware, (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            userId: req.user.userId,
            username: req.user.username,
            email: req.user.email
        }
    });
});

app.post('/posts', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        const { content } = req.body;
        const userId = req.user.userId;
        const username = req.user.username; 

        const newPost = new Post({
            content,
            image: req.file ? req.file.filename : null,
            userId,
            username 
        });

        await newPost.save();

        res.status(201).json({ success: true, data: { ...newPost._doc } }); 
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.get('/get-posts', authMiddleware, async (req, res) => {
    try {
        const posts = await Post.find().populate('comments').sort({ createdAt: -1 }).exec();
        res.status(200).json({ data: posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Error fetching posts' });
    }
});

app.patch('/like/:postId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

       
        if (!post.likes) post.likes = [];
        if (!post.dislikes) post.dislikes = [];

        
        if (post.dislikes.includes(userId)) {
            post.dislikes.pull(userId);
        }

        if (!post.likes.includes(userId)) {
            post.likes.push(userId);
        }

        await post.save();
        res.json({ success: true, likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (err) {
        console.error('Error occurred:', err.message);
        res.status(500).json({ message: err.message });
    }
});

app.patch('/dislike/:postId', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const post = await Post.findById(req.params.postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        
        if (!post.likes) post.likes = [];
        if (!post.dislikes) post.dislikes = [];

        
        if (post.likes.includes(userId)) {
            post.likes.pull(userId);
        }

        if (!post.dislikes.includes(userId)) {
            post.dislikes.push(userId);
        }

        await post.save();
        res.json({ success: true, likes: post.likes.length, dislikes: post.dislikes.length });
    } catch (err) {
        console.error('Error occurred:', err.message);
        res.status(500).json({ message: err.message });
    }
});


app.post('/posts/:postId/comments', authMiddleware, async (req, res) => {
    const { text } = req.body;
  
    try {
      const post = await Post.findById(req.params.postId);
  
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
  
      const user = await User.findById(req.user.userId);
  
      post.comments.push({ userId: req.user.userId, username: user.username, text });
  
      await post.save();
      res.status(201).json({ data: post });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

app.delete('/posts/:postId/comments/:commentId', authMiddleware, async (req, res) => {
    try {
      const post = await Post.findById(req.params.postId);
  
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
  
      const commentIndex = post.comments.findIndex(comment => comment._id.toString() === req.params.commentId);
  
      if (commentIndex === -1) {
        return res.status(404).json({ message: 'Comment not found' });
      }
  
      if (post.comments[commentIndex].userId.toString() !== req.user.userId) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
  
      post.comments.splice(commentIndex, 1);
  
      await post.save();
      res.status(200).json({ data: post });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/posts/:postId', authMiddleware, async (req, res) => {
    try {
        const postId = req.params.postId;
        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        await Post.findByIdAndDelete(postId); 
        res.json({ msg: 'Post deleted successfully' });
    } catch (err) {
        console.error('Error occurred:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/checkEmail/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const user = await User.findOne({ email });
        if (user) {
            const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.status(200).json({ exists: true, user, token });  
        } else {
            res.status(404).json({ exists: false });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server Error');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});