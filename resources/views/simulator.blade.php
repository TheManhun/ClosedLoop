
@extends('layouts.app')

@section('title', 'Simulator')

@section('content')
    <h1>Simulator</h1>
    <p>This page will host the Closed Loop simulator interface.</p>

    <div class="simulator-root-wrapper" style="margin-top:1rem">
        <div class="simulator-toolbar" aria-hidden="false" style="display:none" id="simulator-toolbar">
            <div class="simulator-palette" role="toolbar" aria-label="Building palette">
                <button id="place-process-unit-btn" class="toolbar-button" aria-pressed="false">Process Unit</button>
            </div>
            <button id="toggle-show-names-btn" class="toolbar-button" aria-pressed="false">Show Names</button>
        </div>
        <div id="simulator-root"></div>
    </div>
@endsection

@section('scripts')
    @vite('resources/js/simulator.js')
@endsection
