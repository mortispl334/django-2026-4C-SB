from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from .models import Question, Choice


def index(request):
    users = User.objects.all() if request.user.is_superuser else None
    questions = Question.objects.all()
    context = {
        'users': users,
        'questions': questions,
        'form': AuthenticationForm()
    }
    return render(request, 'polls/index.html', context)


def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            messages.success(request, f"Zalogowano jako {user.username}")
        else:
            messages.error(request, "Błędny login lub hasło")
    return redirect('polls:index')


def logout_view(request):
    logout(request)
    messages.info(request, "Wylogowano pomyślnie")
    return redirect('polls:index')


def register_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')

        if not username or not password:
            messages.error(request, "Uzupełnij wszystkie pola")
            return redirect('polls:index')

        if User.objects.filter(username=username).exists():
            messages.error(request, "Użytkownik już istnieje")
            return redirect('polls:index')

        user = User.objects.create_user(username=username, password=password)
        login(request, user)
        messages.success(request, f"Konto utworzone: {username}")
    return redirect('polls:index')


def delete_user(request):
    if request.method == 'POST' and request.user.is_superuser:
        target_id = request.POST.get('target')
        if target_id:
            User.objects.filter(id=target_id).exclude(id=request.user.id).delete()
            messages.success(request, "Użytkownik usunięty")
    return redirect('polls:index')


def chess_game(request):
    return render(request, 'polls/index.html')


@require_POST
@login_required
def vote_view(request, question_id):
    question = get_object_or_404(Question, pk=question_id)
    choice_id = request.POST.get('choice')

    if not choice_id:
        messages.error(request, "Nie wybrano odpowiedzi!")
        return redirect('polls:index')

    choice = get_object_or_404(Choice, pk=choice_id, question=question)
    choice.votes += 1
    choice.save()

    messages.success(request, f"Głos na '{choice.choice_text}' został zapisany!")
    return redirect('polls:index')