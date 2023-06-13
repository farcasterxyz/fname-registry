import request from 'supertest';
import {app} from "../src/app";

describe('app', () => {
    test('should returns transfers', async () => {
        const response = await request(app).get('/transfers');
        expect(response.status).toBe(200);
        expect(response.body.transfers).toHaveLength(4);
    });
    test('should returns transfers since an id', async () => {
        const response = await request(app).get('/transfers?since=2');
        expect(response.status).toBe(200);
        expect(response.body.transfers).toHaveLength(2);
    });
})