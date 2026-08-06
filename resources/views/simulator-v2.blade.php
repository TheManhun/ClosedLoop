@extends('layouts.app')

@section('title', 'Simulator V2')

@section('content')
    <div id="closed-loop-v2-root" style="white-space: pre-wrap; font-family: monospace; padding: 1rem;"></div>
@endsection

@section('scripts')
    @vite(['resources/js/v2/main.js'])
@endsection
