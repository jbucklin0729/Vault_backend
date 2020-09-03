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

// const transporter = nodemailer.createTransport({
//   host: 'smtp.gmail.com', // Gmail Host
//   port: 465, // Port
//   secure: true, // this is true as port is 465
//   auth: {
//   user: 'correo@correo.com', //Gmail username
//   pass: '123456789' // Gmail password
//   }});
//   const info = await transporter.sendMail({
//   from: "I'm Hacker Man<arpe@correo.com>",
//   to: '1@correo.com',
//   subject: 'Email Send NodeMailer',
//   html: contentHTML
//   });


module.exports = sendEmail;