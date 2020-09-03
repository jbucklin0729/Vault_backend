require('dotenv').config();

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_KEY);

// @link https://stackoverflow.com/questions/28774276/sendgrid-send-email-with-template
// @link https://stackoverflow.com/questions/39489229/pass-variable-to-html-template-in-nodemailer
const sendEmail = async({
    type = 'single',
    to,
    subject,
    text,
    html,
}) => {
    const msg = {
        to,
        from: 'no-reply@hydrovault.io',
        subject,
        text,
        html,
    };
    if (type === 'single') {
        return sgMail.send(msg);
    }
    return sgMail.sendMultiple(msg);

};


module.exports = sendEmail;