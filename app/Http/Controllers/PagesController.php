<?php

namespace App\Http\Controllers;

class PagesController extends Controller
{
    public function home()
    {
        return view('home');
    }

    public function simulator()
    {
        return view('simulator');
    }

    public function about()
    {
        return view('about');
    }
}
