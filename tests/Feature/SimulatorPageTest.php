<?php

test('simulator page loads successfully', function () {
    $response = $this->get('/simulator');

    $response->assertStatus(200);
    $response->assertSee('Simulator');
});
