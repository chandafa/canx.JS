"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueController = void 0;
const Controller_1 = require("../../mvc/Controller");
const View_1 = require("../../mvc/View");
const Dashboard_1 = require("./Dashboard");
const Queue_1 = require("../Queue");
let QueueController = class QueueController extends Controller_1.BaseController {
    index() {
        return this.response.html((0, View_1.render)(() => (0, Dashboard_1.Dashboard)()));
    }
    async stats() {
        const stats = await Queue_1.queue.getStats();
        return this.json(stats);
    }
    async failed() {
        const jobs = await Queue_1.queue.getFailed();
        return this.json(jobs);
    }
    async pending() {
        const jobs = await Queue_1.queue.getPending();
        return this.json(jobs);
    }
    async retry() {
        const id = this.param('id');
        if (!id)
            return this.json({ error: 'ID required' }, 400);
        await Queue_1.queue.retry(id);
        return this.json({ success: true });
    }
    async clear() {
        await Queue_1.queue.clear();
        return this.json({ success: true });
    }
};
exports.QueueController = QueueController;
__decorate([
    (0, Controller_1.Get)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "index", null);
__decorate([
    (0, Controller_1.Get)('/api/stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "stats", null);
__decorate([
    (0, Controller_1.Get)('/api/jobs/failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "failed", null);
__decorate([
    (0, Controller_1.Get)('/api/jobs/pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "pending", null);
__decorate([
    (0, Controller_1.Post)('/api/jobs/retry/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "retry", null);
__decorate([
    (0, Controller_1.Post)('/api/clear'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QueueController.prototype, "clear", null);
exports.QueueController = QueueController = __decorate([
    (0, Controller_1.Controller)('/canx-queue')
], QueueController);
