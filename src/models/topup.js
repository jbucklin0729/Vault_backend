const mongoose = require('mongoose');

const topupSchema = new mongoose.Schema({
  snowflake_id: {
    type: Number,
    unique: true,
  },
  topup_wallet: {
    type: String,
    unique: true,
  },
  topup_pk: String,
  last_checked: Date,
}, {
  timestamps: true,
});

// define compound indexes in the schema
topupSchema.index({
  snowflake_id: 1,
});

const Topup = mongoose.model('Topup', topupSchema);

exports.Topup = Topup;
