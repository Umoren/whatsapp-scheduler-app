const v8 = require('node:v8');
const { createModuleLogger } = require('../middlewares/logger');

const logger = createModuleLogger('MemoryLeakMonitor');

class MemoryLeakMonitor {
    constructor(options = {}) {
        this.checkInterval = options.checkInterval || 5 * 60 * 1000; // 5 minutes
        this.heapGrowthThreshold = options.heapGrowthThreshold || 0.1; // 10% growth
        this.consecutiveIncreases = options.consecutiveIncreases || 3;
        this.maxHeapSizeMB = options.maxHeapSizeMB || 512; // 512 MB
        this.gcThresholdMB = options.gcThresholdMB || 256; // 256 MB

        this.lastHeapUsed = 0;
        this.increasesCount = 0;
        this.isMonitoring = false;
        this.intervalId = null;
    }

    start() {
        if (this.isMonitoring) {
            logger.warn('Memory leak monitor is already running');
            return;
        }

        this.isMonitoring = true;
        this.intervalId = setInterval(() => this.checkMemory(), this.checkInterval);
        logger.info('Memory leak monitor started');
    }

    stop() {
        if (!this.isMonitoring) {
            logger.warn('Memory leak monitor is not running');
            return;
        }

        clearInterval(this.intervalId);
        this.isMonitoring = false;
        logger.info('Memory leak monitor stopped');
    }

    checkMemory() {
        const stats = v8.getHeapStatistics();
        const heapUsed = stats.used_heap_size / (1024 * 1024); // Convert to MB
        const heapTotal = stats.total_heap_size / (1024 * 1024); // Convert to MB

        logger.info(`Current heap usage: ${heapUsed.toFixed(2)} MB / ${heapTotal.toFixed(2)} MB`);

        if (heapUsed > this.lastHeapUsed * (1 + this.heapGrowthThreshold)) {
            this.increasesCount++;
            logger.warn(`Heap usage increased by more than ${this.heapGrowthThreshold * 100}%`);

            if (this.increasesCount >= this.consecutiveIncreases) {
                logger.error('Potential memory leak detected');
                this.logMemoryStats();
            }
        } else {
            this.increasesCount = 0;
        }

        this.lastHeapUsed = heapUsed;

        // Check if heap size exceeds the maximum allowed
        if (heapTotal > this.maxHeapSizeMB) {
            logger.error(`Heap size (${heapTotal.toFixed(2)} MB) exceeds maximum allowed (${this.maxHeapSizeMB} MB)`);
            this.logMemoryStats();
        }

        // Trigger garbage collection if heap usage exceeds the threshold
        if (heapUsed > this.gcThresholdMB && global.gc) {
            logger.warn(`Heap usage (${heapUsed.toFixed(2)} MB) exceeds GC threshold (${this.gcThresholdMB} MB). Triggering GC.`);
            global.gc();
        }
    }

    logMemoryStats() {
        const stats = v8.getHeapStatistics();
        logger.error('Detailed memory statistics:', {
            heapSizeLimit: `${(stats.heap_size_limit / (1024 * 1024)).toFixed(2)} MB`,
            totalHeapSize: `${(stats.total_heap_size / (1024 * 1024)).toFixed(2)} MB`,
            usedHeapSize: `${(stats.used_heap_size / (1024 * 1024)).toFixed(2)} MB`,
            externalMemory: `${(stats.external_memory / (1024 * 1024)).toFixed(2)} MB`,
            heapSpaces: v8.getHeapSpaceStatistics().map(space => ({
                name: space.space_name,
                size: `${(space.space_size / (1024 * 1024)).toFixed(2)} MB`,
                used: `${(space.space_used_size / (1024 * 1024)).toFixed(2)} MB`,
                available: `${(space.space_available_size / (1024 * 1024)).toFixed(2)} MB`,
            }))
        });
    }
}

module.exports = MemoryLeakMonitor;