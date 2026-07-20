
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <h1>Simulator</h1>
    <p>This page will host the Closed Loop simulator interface.</p>

    <div class="simulator-root-wrapper" style="margin-top:1rem">
        <div id="simulator-root"></div>
    </div>
@endsection

@section('scripts')
    @vite('resources/js/simulator.js')
@endsection
