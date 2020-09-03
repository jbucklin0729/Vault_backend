/* eslint-disable no-undef */
const request = require('supertest');
const { expect } = require('chai');
const faker = require('faker');
const code = require('http-status-codes');
const message = require('../src/constants/messages');

let host;
let token = null;

before((done) => {
  // this.enableTimeouts(false);
  // eslint-disable-next-line global-require
  host = require('../bin/www');
  done();
});

after(() => {
  host.close();
});

describe('USER', () => {
  it('Should return a 404 error', (done) => {
    request(host)
      .delete('/v1/blowallaway')
      .end((err, res) => {
        if (err) return done(err);
        const { body } = res;
        expect(body).to.have.keys(['statusCode', 'status', 'message']);
        expect(body.statusCode).to.eq(code.NOT_FOUND);
        expect(body.status).to.eq(message.ERROR);
        expect(body.message).to.eq(message.ROUTE_NOT_FOUND);
        return done();
      });
  });

  //   it('Should blow away users in the database', (done) => {
  //     request(host)
  //       .delete('/v1/user/blowallaway')
  //       .end((err, res) => {
  //         if (err) return done(err);
  //         expect(res.body.statusCode).to.eq(code.OK);
  //         return done();
  //       });
  //   });

  //   it('Should register a user', (done) => {
  //     const newUser = {
  //       first_name: faker.name.firstName(),
  //       last_name: faker.name.lastName(),
  //       email: 'oluwafemiakinde@gmail.com',
  //       secondary_email: faker.internet.email(),
  //       password: 'Password1',
  //       confirm_password: 'Password1',
  //     };
  //     request(host)
  //       .post('/v1/user/register')
  //       .send(newUser)
  //       .end((err, res) => {
  //         if (err) return done(err);
  //         const { body } = res;
  //         expect(body).to.be.an('object');
  //         expect(body).to.have.all.keys(['statusCode', 'status', 'data']);
  //         expect(body.statusCode).to.eq(code.CREATED);
  //         expect(body.status).to.eq(message.SUCCESS);
  //         expect(body.data).to.be.an('object');
  //         return done();
  //       });
  //   });

  it('Should login a user', (done) => {
    const loginUser = {
      email: 'oluwafemiakinde@gmail.com',
      password: 'Password2',
    };
    request(host)
      .post('/v1/user/login')
      .send(loginUser)
      .expect(code.OK)
      .end((err, res) => {
        if (err) return done(err);
        const { body } = res;
        token = res.body.data.token;
        expect(body).to.be.an('object');
        expect(body.data).to.be.an('object');
        expect(body.statusCode).to.eq(code.OK);
        expect(token).to.be.not.empty;
        return done();
      });
  });

  // it('Should return an error on duplicate registration', (done) => {
  //   const newUser = {
  //     first_name: faker.name.firstName(),
  //     last_name: faker.name.lastName(),
  //     email: 'oluwafemiakinde@gmail.com',
  //     secondary_email: faker.internet.email(),
  //     password: 'Password1',
  //     confirm_password: 'Password1',
  //   };
  //   request(host)
  //     .post('/v1/user/register')
  //     .send(newUser)
  //     .end((err, res) => {
  //       if (err) return done(err);
  //       const { body } = res;
  //       expect(body).to.be.an('object');
  //       expect(body).to.have.property('statusCode');
  //       expect(body.statusCode).to.eq(code.CONFLICT);
  //       expect(body.payload).to.be.an('object');
  //       expect(body.payload).to.have.keys(['statusCode', 'error', 'message']);
  //       expect(body.payload.message).to.eq(message.EMAIL_EXIST);
  //       return done();
  //     });
  // });

  //   it('Should return an error because user email is not verified', (done) => {
  //     const loginUser = {
  //       email: 'oluwafemiakinde@gmail.com',
  //       password: 'Password1',
  //     };
  //     request(host)
  //       .post('/v1/user/login')
  //       .send(loginUser)
  //       .end((err, res) => {
  //         if (err) return done(err);
  //         const { body } = res;
  //         expect(body).to.be.an('object');
  //         expect(body).to.have.all.keys(['statusCode', 'payload']);
  //         expect(body.statusCode).to.eq(code.PRECONDITION_REQUIRED);
  //         expect(body.payload).to.be.an('object');
  //         expect(body.payload.message).to.eq(message.USER_NOT_VERIFIED);
  //         return done();
  //       });
  //   });

  //   it('Should verify a new user\'s token', (done) => {
  //     request(host)
  //       .post('/v1/user/verify')
  //       .send({ verification_token: 't9XfmHd8' })
  //       .end((err, res) => {
  //         if (err) return done(err);
  //         const { body } = res;
  //         expect(body).to.be.an('object');
  //         expect(body.statusCode).to.eq(code.OK);
  //         expect(body.status).to.eq(message.SUCCESS);
  //         expect(body.data).to.be.an('object');
  //         expect(body.data.message).to.eq(message.OPERATION_SUCCESS);
  //         return done();
  //       });
  //   });

  it('Should return an error because of Invalid username/password', (done) => {
    const loginUser = {
      email: 'oluwafemiakinde@gmail.com',
      password: 'Password100',
    };
    request(host)
      .post('/v1/user/login')
      .send(loginUser)
      .end((err, res) => {
        if (err) return done(err);
        const { body } = res;
        expect(body).to.be.an('object');
        expect(body.statusCode).to.eq(code.PRECONDITION_FAILED);
        expect(body.payload).to.be.an('object');
        expect(body.payload.message).to.eq(message.WRONG_USERNAME_PASSWORD);
        return done();
      });
  });

  it('Should get user profile', (done) => {
    request(host)
      .get('/v1/user/account/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(code.OK)
      .end((err, res) => {
        if (err) return done(err);
        const { body } = res;
        expect(body).to.be.an('object');
        expect(body.status).to.eq(message.SUCCESS);
        expect(body.data.profile).to.be.an('object');
        expect(body.data.profile).to.have.keys('first_name', 'last_name', 'email', 'secondary_email', 'vaults');
        return done();
      });
  });
});
