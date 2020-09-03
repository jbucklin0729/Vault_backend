/* eslint-disable no-undef */
const request = require('supertest');
const { expect } = require('chai');
const code = require('http-status-codes');
const message = require('../src/constants/messages');

let host;
let token = null;

before((done) => {
    // this.enableTimeouts(false); //
    // eslint-disable-next-line global-require
    host = require('../bin/www');
    done();
});

after(() => {
    host.close();
});


describe('PASSWORD', () => {
    it('Should login a user', (done) => {
        const loginUser = {
            email: 'oluwafemiakinde@gmail.com',
            password: 'Password1',
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


    it('Should change a user\'s password', (done) => {
        const newPasswordInfo = {
            old_password: 'Password2',
            new_password: 'Password2',
            confirm_password: 'Password2',
        };
        request(host)
            .post('/v1/account/change_password')
            .send(newPasswordInfo)
            .set('Authorization', `Bearer ${token}`)
            // .expect(code.OK)
            .end((err, res) => {
                if (err) return done(err);
                const { body } = res;
                expect(body).to.be.an('object');
                expect(body.status).to.eq(message.SUCCESS);
                expect(body.data).to.be.an('object');
                return done();
            });
    });

    it('Should throw a No Auth Token error', (done) => {
        request(host)
            .post('/v1/account/change_password')
            .send({ email: 'oluwafemiakinde@gmail.com' })
            .expect(code.UNAUTHORIZED)
            .end((err, res) => {
                if (err) return done(err);
                const { body } = res;
                expect(body).to.be.an('object');
                expect(body.payload.message).to.eq('No auth token');
                return done();
            });
    });

    it('Should send an email to user for forgot password', (done) => {
        request(host)
            .post('/v1/user/forgot_password')
            .send({ email: 'oluwafemiakinde@gmail.com' })
            .expect(code.OK)
            .set('Authorization', `Bearer ${token}`)
            .end((err, res) => {
                if (err) return done(err);
                const { body } = res;
                expect(body).to.be.an('object');
                expect(body.status).to.eq(message.SUCCESS);
                expect(body.data).to.be.an('object');
                return done();
            });
    });


    it('Should require all fields', (done) => {
        const newPasswordInfo = {
            old_password: 'Password1',
            new_password: 'Password2',
            confirm_password: 'Password2',
        };
        request(host)
            .post('/v1/account/change_password')
            .send(newPasswordInfo)
            .expect(code.BAD_REQUEST)
            .set('Authorization', `Bearer ${token}`)
            .end((err, res) => {
                if (err) return done(err);
                const { body } = res;
                expect(body).to.be.an('object');
                expect(body.payload).to.be.an('object');
                return done();
            });
    });
});