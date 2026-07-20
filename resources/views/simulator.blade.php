
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <h1>Simulator</h1>
    <p>This page will host the Closed Loop simulator interface.</p>

    <div class="simulator-root-wrapper" style="margin-top:1rem">
        <div class="simulator-toolbar" aria-hidden="false">
            <button id="place-process-unit-btn" class="toolbar-button" aria-pressed="false">Place Process Unit</button>
        </div>
        <div id="simulator-root"></div>
    </div>
@endsection

@section('scripts')
    @vite('resources/js/simulator.js')
@endsection
