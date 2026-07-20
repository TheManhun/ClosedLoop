
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <h1>Simulator</h1>
    <p>This page will host the Closed Loop simulator interface.</p>

    <div id="simulator-root" style="width:100%;max-width:1024px;height:600px;margin-top:1rem"></div>
@endsection

@section('scripts')
    @vite('resources/js/simulator.js')
@endsection
