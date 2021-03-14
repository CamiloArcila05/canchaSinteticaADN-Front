import { Component, OnInit } from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {ActivatedRoute, Router} from "@angular/router";
import {CanchaService} from "../../shared/service/cancha.service";
import {Cancha} from "../../shared/model/cancha";
import {NgxSpinnerService} from "ngx-spinner";
import {ToastrService} from "ngx-toastr";

const LONGITUD_MINIMA_PERMITIDA_TEXTO = 3;
const LONGITUD_MAXIMA_PERMITIDA_TEXTO = 150;

@Component({
  selector: 'app-editar-cancha',
  templateUrl: './editar-cancha.component.html',
  styleUrls: ['./editar-cancha.component.scss']
})
export class EditarCanchaComponent implements OnInit {

  canchaForm: FormGroup;
  canchaSeleccioanda: Cancha;
  estados = ['ACTIVO', 'INACTIVO'];
  showToast = false;

  constructor(private router: Router,
              private spinner: NgxSpinnerService,
              private toast: ToastrService,
              private canchaService: CanchaService,
              private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.cargaFormulario();
  }

  cargaFormulario() {
    this.canchaSeleccioanda = JSON.parse(localStorage.getItem('canchaSeleccionada'));
    this.canchaForm = new FormGroup({
      nombre: new FormControl(this.canchaSeleccioanda.nombre, [Validators.required]),
      estado: new FormControl(this.canchaSeleccioanda.estado, [Validators.required]),
      valorDia: new FormControl(this.canchaSeleccioanda.valorDia, [Validators.required, Validators.min(1)]),
      valorNoche: new FormControl(this.canchaSeleccioanda.valorNoche, [Validators.required, Validators.min(1)]),
      descripcion: new FormControl(this.canchaSeleccioanda.descripcion, [Validators.required,
        Validators.minLength(LONGITUD_MINIMA_PERMITIDA_TEXTO),
        Validators.maxLength(LONGITUD_MAXIMA_PERMITIDA_TEXTO)])
    });
  }


  cancelar() {
    localStorage.removeItem('canchaSeleccionada');
    this.router.navigate([ '../../cancha' ], { relativeTo: this.route });
  }

  actualizarCancha() {
    const formValues = this.canchaForm.getRawValue();
    console.log(formValues);
    const cancha = <Cancha> {
      id: this.canchaSeleccioanda.id,
      nombre: formValues.nombre,
      descripcion: formValues.descripcion,
      estado: formValues.estado,
      valorDia: formValues.valorDia,
      valorNoche: formValues.valorNoche
    };
    this.spinner.show();
    this.canchaService.actualizar(cancha)
      .subscribe(
        () => {
          this.spinner.hide();
          this.toast.success('La informacion de la cancha ha sido actualizada', 'Éxito');
          this.cancelar();
        },
        () => {
          this.spinner.hide();
          this.toast.error('Ha ocurrido un error inesperado', 'Error');
        }
        );
  }

}
