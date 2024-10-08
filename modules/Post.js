const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  username: { type: String, required: true }, 
  content: { type: String, required: true },
  image: { type: String, default: null },
  likes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  dislikes: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
  comments: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      username: {
        type: String,
      },
      text: {
        type: String,
      },
    }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', PostSchema);
