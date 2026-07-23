<?php

use function Pest\Laravel\get;

test('GET /api/machines/{id} returns machine shape with resources and links arrays', function () {
    $response = $this->get('/api/machines/1');
    $response->assertStatus(200);
    $json = $response->json();
    $this->assertIsArray($json);
    $this->assertArrayHasKey('id', $json);
    $this->assertArrayHasKey('name', $json);
    $this->assertArrayHasKey('resources', $json);
    $this->assertArrayHasKey('links', $json);
    $this->assertArrayHasKey('technologies', $json);
    $this->assertIsArray($json['resources']);
    $this->assertIsArray($json['links']);
    $this->assertIsArray($json['technologies']);
    // For machine 1 we expect linked technologies to exist
    $this->assertNotEmpty($json['technologies']);
    foreach ($json['technologies'] as $tech) {
        $this->assertArrayHasKey('id', $tech);
        $this->assertArrayHasKey('name', $tech);
        $this->assertArrayHasKey('role', $tech);
        $this->assertArrayHasKey('category', $tech);
        $this->assertArrayHasKey('maturity_level', $tech);
    }

    // Resources assertions per new contract
    $this->assertCount(7, $json['resources']);
    $inputCount = 0;
    $outputCount = 0;
    $inputTotal = 0;
    $outputTotal = 0;
    foreach ($json['resources'] as $res) {
        $this->assertArrayHasKey('id', $res);
        $this->assertArrayHasKey('name', $res);
        $this->assertArrayHasKey('direction', $res);
        $this->assertArrayHasKey('amount', $res);
        $this->assertArrayHasKey('unit', $res);
        $this->assertArrayHasKey('category', $res);

        $dir = strtolower((string)($res['direction'] ?? ''));
        $amt = is_numeric($res['amount']) ? floatval($res['amount']) : 0;
        if ($dir === 'input') { $inputCount++; $inputTotal += $amt; }
        if ($dir === 'output') { $outputCount++; $outputTotal += $amt; }
    }

    $this->assertEquals(1, $inputCount, 'expected 1 input for machine 1');
    $this->assertEquals(6, $outputCount, 'expected 6 outputs for machine 1');
    $this->assertEquals(100, $inputTotal, 'input total should equal 100');
    $this->assertEquals(100, $outputTotal, 'output total should equal 100');
});

test('GET /api/machines/{id} returns 404 for missing machine', function () {
    // use a very large id that is unlikely to exist
    $response = $this->get('/api/machines/999999');
    $response->assertStatus(404);
});
