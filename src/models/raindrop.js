const mongoose = require('mongoose');

const raindropSchema = new mongoose.Schema({
  internal_username: {
    type: String,
    unique: true,
  },
  hydro_id: {
    type: String,
    unique: true,
  },
  confirmed: Boolean,
}, {
  toJSON: true,
  timestamps: true,
});

// define compound indexes in the schema
raindropSchema.index({
  internal_username: 1,
  hydro_id: 1,
});


const Raindrop = mongoose.model('Raindrop', raindropSchema);

module.exports = Raindrop;
